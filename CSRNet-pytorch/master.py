import cv2
import numpy as np
import torch
import base64
import time
import threading
import eventlet
import os
import uuid
import json
from torchvision import transforms
from flask import Flask, Response, request, jsonify
from flask_socketio import SocketIO, emit, join_room
from werkzeug.utils import secure_filename
from services.s3 import upload_file_to_s3, create_presigned_get_url, download_s3_to_local
from services.livekit import generate_token

# Patch for better async performance with Flask-SocketIO
eventlet.monkey_patch()

from model import CSRNet

# ----------------------
# Configuration
# ----------------------
RTMP_URL = os.getenv('DRONE_RTMP_INPUT_URL', "rtmp://192.168.2.90:1935/live/dji")
MODEL_PATH = os.getenv('MODEL_PATH', "csrnet_pretrained.pth")
UPLOAD_FOLDER = 'uploads' # Local temp folder
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# ----------------------
# Device + Model Setup
# ----------------------
def load_model():
    """Load CSRNet model with comprehensive error handling."""
    if torch.backends.mps.is_available():
        device = torch.device("mps")
    elif torch.cuda.is_available():
        device = torch.device("cuda")
    else:
        device = torch.device("cpu")
    
    print(f"Using device: {device}")
    
    model = None
    try:
        model = CSRNet().to(device)
        state = torch.load(MODEL_PATH, map_location=device)
        model.load_state_dict(state)
        model.eval()
        print("[OK] Loaded pretrained CSRNet weights successfully")
    except FileNotFoundError:
        print(f"[WARN] Warning: {MODEL_PATH} not found. Model will not generate heatmaps.")
        model = None
    except Exception as e:
        print(f"[WARN] Warning: Error loading model weights: {e}")
        model = None
    
    return model, device

model, device = load_model()

# ImageNet-style preprocessing
transform = transforms.Compose([
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])

# ----------------------
# Flask + SocketIO
# ----------------------
app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

@app.after_request
def after_request(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization'
    response.headers['Access-Control-Allow-Methods'] = 'GET,PUT,POST,DELETE,OPTIONS'
    return response

# ----------------------
# Analytics Logic
# ----------------------
smoothed_count = None
SMOOTHING_ALPHA = 0.3

def process_frame_for_heatmap(frame):
    """
    Run CSRNet, get density map, and downsample for frontend grid.
    Returns: (heatmap_grid_list, stats_dict)
    """
    global model, device, smoothed_count
    
    # Defaults
    dummy_stats = {
        "totalPeople": 0, "globalDensity": 0.0,
        "globalRiskLevel": "low", "maxDensity": 0.0
    }
    dummy_grid = [0.0] * (60 * 40)

    if model is None:
        return dummy_grid, dummy_stats
    
    try:
        # Resize for inference speed
        target_w, target_h = 640, 360
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        rgb_resized = cv2.resize(rgb, (target_w, target_h))
        
        img_tensor = transform(rgb_resized).unsqueeze(0).to(device)
        
        with torch.no_grad():
            density = model(img_tensor)
        
        density_map = density.squeeze().cpu().numpy()
        density_map = np.maximum(density_map, 0)
        
        # Scale count (CSRNet specific adjustment)
        total_count_raw = np.sum(density_map)
        total_count_scaled = total_count_raw / 100.0
        
        # Smoothing
        if smoothed_count is None:
            smoothed_count = total_count_scaled
        else:
            smoothed_count = (SMOOTHING_ALPHA * total_count_scaled) + ((1 - SMOOTHING_ALPHA) * smoothed_count)
        
        total_count = smoothed_count
        
        # Downsample to 60x40 grid
        grid_w, grid_h = 60, 40
        grid_map = cv2.resize(density_map, (grid_w, grid_h), interpolation=cv2.INTER_AREA)
        
        max_val = np.max(grid_map)
        
        # Risk Logic
        risk_level = "low"
        if total_count > 500 or max_val > 0.8: risk_level = "critical"
        elif total_count > 300 or max_val > 0.5: risk_level = "high"
        elif total_count > 100: risk_level = "medium"
            
        stats = {
            "totalPeople": int(total_count),
            "globalDensity": float(min(total_count / 1000.0, 1.0)), 
            "globalRiskLevel": risk_level,
            "maxDensity": float(max_val)
        }
        
        return grid_map.flatten().tolist(), stats
        
    except Exception as e:
        print(f"Error in process_frame_for_heatmap: {e}")
        return dummy_grid, dummy_stats

# ----------------------
# Background Jobs
# ----------------------

# Drone Processing Job
drone_thread = None
drone_active = False

def drone_processing_loop():
    """Background task to read RTMP and emit analytics."""
    global drone_active
    print(f"Starting Drone Processing Loop via {RTMP_URL}")
    cap = cv2.VideoCapture(RTMP_URL)
    
    HEATMAP_INTERVAL = 3 # Process every 3rd frame
    frame_count = 0
    
    while drone_active:
        if not cap.isOpened():
             print(f"RTMP source {RTMP_URL} not ready, re-check in 5s...")
             socketio.sleep(5)
             cap = cv2.VideoCapture(RTMP_URL)
             continue

        success, frame = cap.read()
        if not success:
            # print("Failed to read drone frame. Retrying...") 
            # (Reduce log spam)
            cap.release()
            socketio.sleep(1)
            cap = cv2.VideoCapture(RTMP_URL)
            continue
            
        frame_count += 1
        if frame_count % HEATMAP_INTERVAL == 0:
            heatmap_grid, stats = process_frame_for_heatmap(frame)
            # Emit to 'drone_feed' room
            socketio.emit('analytics:update', {
                'grid': heatmap_grid,
                'stats': stats,
                'timestamp': time.time() * 1000,
                'sourceType': 'drone'
            }, room='drone_feed')
            
        socketio.sleep(0.01) # Yield
        
    cap.release()

# Uploaded Video Processing Logic
def process_uploaded_video_job(filepath, video_id, client_id):
    """
    Reads a local video file, runs inference, emits analytics synced to video timestamp.
    Deletes the local file upon completion.
    """
    print(f"Starting processing for video {video_id} at {filepath}")
    cap = cv2.VideoCapture(filepath)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    
    HEATMAP_INTERVAL_FRAMES = 5
    processed_count = 0
    
    while cap.isOpened():
        success, frame = cap.read()
        if not success:
            break
            
        current_time_ms = cap.get(cv2.CAP_PROP_POS_MSEC)
        
        if processed_count % HEATMAP_INTERVAL_FRAMES == 0:
            heatmap_grid, stats = process_frame_for_heatmap(frame)
            
            # Emit event to specific room
            room_name = f"video_{video_id}"
            socketio.emit('analytics:update', {
                't_ms': current_time_ms, # Sync key for frontend
                'grid': heatmap_grid,
                'stats': stats,
                'sourceType': 'upload'
            }, room=room_name)
            
        processed_count += 1
        socketio.sleep(0.001) # Yield to event loop
        
    cap.release()
    print(f"Finished processing video {video_id}")
    
    # Cleanup local temp file
    try:
        os.remove(filepath)
        print(f"Deleted local temp file: {filepath}")
    except Exception as e:
        print(f"Failed to delete temp file {filepath}: {e}")

# ----------------------
# Routes
# ----------------------

@app.route('/api/livekit/token', methods=['POST'])
def get_livekit_token():
    try:
        data = request.json
        room_name = data.get('roomName', 'default-room')
        participant_identity = data.get('identity', f"user_{uuid.uuid4().hex[:6]}")
        is_publisher = data.get('isPublisher', False)
        
        token = generate_token(room_name, participant_identity, is_publisher=is_publisher)
        
        return jsonify({
            'token': token,
            'url': os.getenv('LIVEKIT_URL'),
            'roomName': room_name
        })
    except Exception as e:
        print(f"Error generating token: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/upload', methods=['POST'])
def upload_video():
    """
    1. Save to local temp.
    2. Upload local temp to S3 (single upload).
    3. Generate presigned URL.
    4. Start background processing on local temp.
    """
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    client_id = request.form.get('clientId', 'anon')
    
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    try:
        ext = os.path.splitext(file.filename)[1]
        video_id = uuid.uuid4().hex
        filename = f"{video_id}{ext}"
        
        # 1. Save to local temp
        temp_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(temp_path)
        
        # 2. Upload to S3 (read from local disk)
        s3_key = f"clients/{client_id}/uploads/{filename}"
        content_type = file.content_type or 'video/mp4'
        
        with open(temp_path, 'rb') as f:
            s3_uri = upload_file_to_s3(f, s3_key, content_type)
        
        # 3. Generate Playback URL
        # e.g. 24 hour expiration
        playback_url = create_presigned_get_url(s3_key, expiration=3600*24)
        
        # 4. Start background processing (using the local file we already have)
        socketio.start_background_task(process_uploaded_video_job, temp_path, video_id, client_id)
        
        return jsonify({
            'success': True,
            'videoId': video_id,
            'playbackUrl': playback_url,
            'websocketRoom': f"video_{video_id}"
        })
        
    except Exception as e:
        print(f"Upload error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/analyze/start', methods=['POST'])
def start_analysis():
    # Only needed if we want to restart analysis without re-uploading
    # Not implemented for MVP
    return jsonify({'message': 'Not implemented'}), 501

# ----------------------
# WebSocket Events
# ----------------------

@socketio.on('join')
def on_join(data):
    room = data.get('room')
    if room:
        join_room(room)
        print(f"Client joined room: {room}")

@socketio.on('process_frame')
def handle_webcam_frame(data):
    """
    DEPRECATED: Websocket frame processing.
    """
    socketio.emit('error', {
        'message': 'Websocket frame processing is deprecated. Use LiveKit publishing.'
    })

# ----------------------
# Startup
# ----------------------

def start_drone_thread():
    global drone_thread, drone_active
    if not drone_active:
        drone_active = True
        drone_thread = socketio.start_background_task(drone_processing_loop)

if __name__ == '__main__':
    print("Starting Flask-SocketIO server on port 5000...")
    start_drone_thread()
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)
