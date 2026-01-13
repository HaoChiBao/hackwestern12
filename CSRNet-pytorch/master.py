# eventlet.monkey_patch()

import cv2
import numpy as np
import torch
import base64
import time
import threading
import os
import uuid
import json
from torchvision import transforms
from flask import Flask, Response, request, jsonify
from flask_socketio import SocketIO, emit, join_room
from flask_cors import CORS
from werkzeug.utils import secure_filename
from services.s3 import upload_file_to_s3, create_presigned_get_url, download_s3_to_local
from services.livekit import generate_token

# Patch for better async performance with Flask-SocketIO
# eventlet.monkey_patch() # moved to top

from model import CSRNet

# ----------------------
# Configuration
# ----------------------
RTMP_URL = os.getenv('DRONE_RTMP_INPUT_URL', "rtmp://172.20.10.2:1935/live/dji")
LIVEKIT_INGRESS_URL = os.getenv('LIVEKIT_INGRESS_RTMP_URL', "")
LIVE_MODE = os.getenv('LIVE_MODE', 'direct_ingress') # 'direct_ingress' or 'ffmpeg_relay'
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
CORS(app, resources={r"/*": {"origins": "*"}})
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

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
             print(f"[DEBUG] RTMP source {RTMP_URL} not ready/closed, re-check in 5s...")
             socketio.sleep(5)
             cap = cv2.VideoCapture(RTMP_URL)
             continue

        success, frame = cap.read()
        if not success:
            print("[DEBUG] Failed to read drone frame (stream invalid or empty). Retrying...") 
            cap.release()
            socketio.sleep(1)
            cap = cv2.VideoCapture(RTMP_URL)
            continue
        
        if frame_count == 0:
            print(f"[DEBUG] FIRST FRAME READ SUCCESS from {RTMP_URL}")
            print(f"[DEBUG] Frame Shape: {frame.shape}")

        frame_count += 1
        if frame_count % 100 == 0:
            print(f"[DEBUG] Processed {frame_count} frames from drone stream")

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

@app.route('/api/livekit/ingress/info', methods=['GET'])
def get_ingress_info():
    """
    Returns connection details for the Drone (Direct Ingress Architecture).
    """
    try:
        ingress_url = os.getenv('LIVEKIT_INGRESS_RTMP_URL', '')
        
        # Mask the secret key for safety if possible
        masked_url = ingress_url
        if 'livekit.cloud' in ingress_url and '/' in ingress_url:
            parts = ingress_url.rsplit('/', 1)
            if len(parts) == 2:
                base, key = parts
                masked_key = key[:4] + '****' + key[-4:] if len(key) > 8 else '****'
                masked_url = f"{base}/{masked_key}"

        return jsonify({
            'roomName': 'default-room',
            'identity': 'drone',
            'publishUrl': ingress_url, # Full URL needed for DJI copy-paste
            'maskedUrl': masked_url,
            'instructions': 'Copy the Publish URL and paste it into your DJI "Custom RTMP" settings.'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/livekit/room/status', methods=['GET'])
def get_room_status():
    """
    Checks if the drone is currently part of the room.
    """
    try:
        room_name = request.args.get('room', 'default-room')
        
        # We need to query LiveKit API
        # Simple check: Is "drone" connected?
        import asyncio
        from services.livekit import get_livekit_config
        from livekit import api
        
        conf = get_livekit_config()
        if not conf['url'] or not conf['api_key']:
             return jsonify({'error': 'LiveKit not configured'}), 500

        # Create localized API instance for this status check
        # (In prod, reuse a global instance)
        lkapi = api.LiveKitAPI(conf['url'], conf['api_key'], os.getenv('LIVEKIT_API_SECRET'))
        
        async def check_participant():
            try:
                # List participants in the room
                # list_participants returns a response object with 'participants' list
                res = await lkapi.room.list_participants(api.ListParticipantsRequest(room=room_name))
                for p in res.participants:
                    if p.identity == 'drone':
                        return {
                            'connected': True,
                            'state': str(p.state),
                            'tracks': [t.sid for t in p.tracks]
                        }
                return {'connected': False}
            finally:
                await lkapi.aclose()

        status = asyncio.run(check_participant())
        return jsonify(status)
        
    except Exception as e:
        print(f"Error checking room status: {e}")
        return jsonify({'error': str(e), 'connected': False})

@app.route('/api/livekit/ingress/create', methods=['POST'])
def create_ingress_endpoint():
    # 1. Security Check
    auth_header = request.headers.get('Authorization')
    expected_secret = os.getenv('ADMIN_DEBUG_TOKEN', 'hackwestern_debug_secret')
    
    # Allow Bearer token or simple direct string match
    token = auth_header.replace('Bearer ', '') if auth_header else ''
    
    if token != expected_secret:
        return jsonify({'error': 'Unauthorized'}), 401

    try:
        data = request.json or {}
        room_name = data.get('room', 'default-room')
        
        # We need to run the async function from sync Flask
        import asyncio
        from services.livekit import create_ingress
        
        # Use asyncio.run()
        info = asyncio.run(create_ingress(room_name))
        
        return jsonify({
            'ingressId': info.ingress_id,
            'url': info.url,
            'streamKey': info.stream_key,
            'fullPublishUrl': f"{info.url}/{info.stream_key}"
        })
        
    except Exception as e:
        print(f"Error creating ingress via API: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/upload', methods=['POST'])
def upload_video():
    """
    1. Save to local temp.
    2. Upload local temp to S3 (single upload).
    3. Generate presigned URL.
    4. Start background processing on local temp.
    """
    print("[DEBUG] /api/upload hit")
    if 'file' not in request.files:
        print("[DEBUG] No file part in request")
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    client_id = request.form.get('clientId', 'anon')
    print(f"[DEBUG] Filename: {file.filename}, ClientID: {client_id}")
    
    if file.filename == '':
        print("[DEBUG] Empty filename")
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
        print(f"[DEBUG] Upload error Exception: {e}")
        import traceback
        traceback.print_exc()
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
    print(f"Starting Flask-SocketIO server on port 8000 (Mode: {LIVE_MODE})...")
    
    if LIVE_MODE == 'ffmpeg_relay':
        print("[INFO] LIVE_MODE=ffmpeg_relay: Starting local ffmpeg relay loop.")
        start_drone_thread() # Enabled for RTMP ingest
    else:
        print(f"[INFO] LIVE_MODE={LIVE_MODE}: Direct Ingress Mode.")
        print(f"[INFO] Expecting DJI to publish to: {LIVEKIT_INGRESS_URL}")
        print("[INFO] Local 'drone_processing_loop' (cv2) DISABLED.")

    socketio.run(app, host='0.0.0.0', port=8000, debug=True)
