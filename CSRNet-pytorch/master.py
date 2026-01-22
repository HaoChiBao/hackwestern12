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
import socket
import subprocess
import traceback
from flask import Flask, Response, request, jsonify
from flask_socketio import SocketIO, emit, join_room
from flask_cors import CORS
from werkzeug.utils import secure_filename
from services.s3 import upload_file_to_s3, create_presigned_get_url, download_s3_to_local
from services.s3 import upload_file_to_s3, create_presigned_get_url, download_s3_to_local
# from services.livekit   <-- REMOVED

# Patch for better async performance with Flask-SocketIO
# eventlet.monkey_patch() # moved to top

from model import CSRNet

# ----------------------
# Configuration
# ----------------------
RTMP_HOST = os.getenv('RTMP_HOST', 'localhost')
RTMP_PORT = int(os.getenv('RTMP_PORT', 1935))
RTMP_STREAM = os.getenv('RTMP_STREAM', 'dji')
RTMP_URL = f"rtmp://{RTMP_HOST}:{RTMP_PORT}/{RTMP_STREAM}"
# LIVEKIT_INGRESS_URL Removed
LIVE_MODE = 'direct_ingress' # Simplified for local stack
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
# Enable CORS for all routes and all origins
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

def check_tcp_connection(host, port, timeout=1.0):
    """Check if a TCP port is open."""
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        result = sock.connect_ex((host, port))
        sock.close()
        return result == 0
    except Exception:
        return False

# Drone Processing Job
drone_thread = None
drone_active = False
drone_status_info = {
    "state": "initializing",
    "last_frame_ts": None,
    "rtmp_url": RTMP_URL,
    "frames_received": 0,
    "error": None
}

def run_ffprobe_check(url):
    """Run ffprobe to check if stream exists and log output."""
    try:
        cmd = ["ffprobe", "-v", "error", "-show_streams", url]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=5)
        if result.returncode == 0:
            print(f"[DEBUG] FFprobe success: {result.stdout}")
            return True
        else:
            print(f"[WARN] FFprobe failed (Code {result.returncode}): {result.stderr}")
            return False
    except FileNotFoundError:
        print("[WARN] ffprobe not installed. Skipping stream check.")
        return False
    except Exception as e:
        print(f"[WARN] FFprobe check error: {e}")
        return False

def drone_processing_loop():
    """Background task to read RTMP and emit analytics."""
    global drone_active, drone_status_info
    print(f"Starting Drone Processing Loop via {RTMP_URL}")
    
    # Exponential backoff parameters
    backoff = 5
    MAX_BACKOFF = 40
    
    cap = None
    frame_count = 0
    start_time = time.time()
    
    while drone_active:
      try:
        # 1. Check if RTMP server is reachable
        if not check_tcp_connection(RTMP_HOST, RTMP_PORT):
             msg = f"RTMP server not reachable at {RTMP_HOST}:{RTMP_PORT}. Waiting {backoff}s..."
             if drone_status_info["state"] != "waiting_for_server":
                 print(f"[WARN] {msg}")
             
             drone_status_info["state"] = "waiting_for_server"
             drone_status_info["error"] = "RTMP Server Unreachable"
             
             socketio.sleep(backoff)
             backoff = min(backoff * 2, MAX_BACKOFF)
             continue

        # 2. Server is up, try to connect to stream
        if cap is None or not cap.isOpened():
             # Diagnostic: Check with ffprobe first if we failed previously
             if drone_status_info["state"] == "connecting":
                 run_ffprobe_check(RTMP_URL)

             cap = cv2.VideoCapture(RTMP_URL)
             if not cap.isOpened():
                 if drone_status_info["state"] != "connecting":
                     print(f"[DEBUG] RTMP stream {RTMP_URL} not ready yet. Retrying in {backoff}s...")
                 
                 drone_status_info["state"] = "connecting"
                 drone_status_info["error"] = "Stream Not Ready"
                 
                 socketio.sleep(backoff)
                 backoff = min(backoff * 2, MAX_BACKOFF)
                 continue
             else:
                 print(f"[INFO] Connected to RTMP stream: {RTMP_URL}")
                 backoff = 5 # Reset backoff on success
                 drone_status_info["state"] = "streaming"
                 drone_status_info["error"] = None
                 # Attempt to read one frame to confirm
                 success, frame = cap.read()
                 if not success:
                     print("[WARN] Connected but failed to read first frame.")
                     cap.release()
                     continue
                 else:
                     frame_count += 1
                     drone_status_info["frames_received"] = frame_count

        success, frame = cap.read()
        if not success:
            # Stream might have ended or interrupted
            drone_status_info["state"] = "interrupted"
            print(f"[WARN] Failed to read frame. Stream might be closed. Reconnecting...")
            cap.release()
            socketio.sleep(1)
            continue
        
        frame_count += 1
        drone_status_info["frames_received"] = frame_count
        
        if frame_count % 100 == 0:
            elapsed = time.time() - start_time
            fps = frame_count / elapsed if elapsed > 0 else 0
            print(f"[DEBUG] Processed {frame_count} frames | FPS: {fps:.2f}")

        if frame_count % 3 == 0: # HEATMAP_INTERVAL
            heatmap_grid, stats = process_frame_for_heatmap(frame)
            # Emit to 'drone_feed' room
            socketio.emit('analytics:update', {
                'grid': heatmap_grid,
                'stats': stats,
                'timestamp': time.time() * 1000,
                'sourceType': 'drone'
            }, room='drone_feed')
            
        # Update status
        drone_status_info["last_frame_ts"] = time.time()
        
        socketio.sleep(0.01) # Yield
      except Exception as e:
          print(f"[ERROR] Drone loop exception: {e}")
          traceback.print_exc()
          drone_status_info["error"] = str(e)
          socketio.sleep(5)
        
    if cap: cap.release()

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

@app.route('/api/stream/info', methods=['GET'])
def get_stream_info():
    """
    Returns connection details for Local MediaMTX stack.
    """
    host = request.host.split(':')[0]
    # For local dev, we assume standard ports
    return jsonify({
        "rtmp_ingest_url": f"rtmp://{host}:1935/dji",
        "webrtc_play_url": f"http://{host}:8889/dji",
        "room": None,
        "notes": "Paste RTMP ingest into DJI. Open webrtc URL in browser. ensure you are on the same Wi-Fi."
    })


@app.route('/api/stream/status', methods=['GET'])
def get_stream_status():
    global drone_status_info
    return jsonify(drone_status_info)

@app.route('/api/rtmp/debug', methods=['GET'])
def get_rtmp_debug():
    """
    Detailed debug info for RTMP ingest.
    """
    global drone_status_info
    return jsonify({
        "info": drone_status_info,
        "rtmp_host": RTMP_HOST,
        "rtmp_port": RTMP_PORT,
        "rtmp_url": RTMP_URL,
        "timestamp": time.time()
    })

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

@app.route('/stop_stream', methods=['POST', 'OPTIONS'])
def stop_stream():
    """
    Manually handle stop stream request with explicit CORS for debugging.
    """
    # 1. Log request details
    print(f"[DEBUG] /stop_stream called. Method: {request.method}, Origin: {request.headers.get('Origin')}")

    # 2. Handle OPTIONS (Preflight)
    if request.method == 'OPTIONS':
        response = Response()
        response.headers.add('Access-Control-Allow-Origin', request.headers.get('Origin', '*'))
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'POST,OPTIONS')
        return response

    # 3. Handle POST
    try:
        # Logic to stop stream if needed (currently just a stub/log)
        print("[INFO] Stop stream requested.")
        
        response = jsonify({"success": True, "message": "Stream stopped"})
        response.headers.add('Access-Control-Allow-Origin', request.headers.get('Origin', '*'))
        return response
    except Exception as e:
        print(f"[ERROR] /stop_stream failed: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/set_source', methods=['POST', 'OPTIONS'])
def set_source():
    if request.method == 'OPTIONS':
        response = Response()
        response.headers.add('Access-Control-Allow-Origin', request.headers.get('Origin', '*'))
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'POST,OPTIONS')
        return response

    print(f"[DEBUG] /set_source called. Data: {request.json}")
    response = jsonify({"success": True})
    response.headers.add('Access-Control-Allow-Origin', request.headers.get('Origin', '*'))
    return response

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
    
    print(f"[INFO] LIVE_MODE={LIVE_MODE}: Streaming Mode.")
    print(f"[INFO] Expecting DJI to push to: {RTMP_URL}")
    
    # We always start the drone processing loop in local mode if we want analytics
    # But wait, now we are feeding from MediaMTX RTMP?
    # Yes, the drone pushes to MediaMTX. MediaMTX re-serves RTMP.
    # So we should read from MediaMTX RTMP URL.
    
    # If using MediaMTX locally:
    # Drone -> MediaMTX (1935)
    # Backend -> MediaMTX (1935)
    
    # Let's ensure the RTMP_URL points to localhost if run locally
    # It defaults to "rtmp://localhost:1935/dji" at top of file
    
    start_drone_thread() # Start always for Local Stack
    print("[INFO] Drone processing loop started.")

    socketio.run(app, host='0.0.0.0', port=8000, debug=True, allow_unsafe_werkzeug=True)
