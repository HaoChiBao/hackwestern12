import cv2
import numpy as np
import torch
import base64
import time
import threading
import eventlet
from torchvision import transforms
from flask import Flask, render_template_string, Response
from flask_socketio import SocketIO, emit

# Patch for better async performance with Flask-SocketIO
eventlet.monkey_patch()

from model import CSRNet

# ----------------------
# Configuration
# ----------------------
RTMP_URL = "rtmp://192.168.2.90:1935/live/dji"  # Drone stream
# Fallback removed

# ----------------------
# Device + Model Setup
# ----------------------
def load_model():
    if torch.backends.mps.is_available():
        device = torch.device("mps")
    elif torch.cuda.is_available():
        device = torch.device("cuda")
    else:
        device = torch.device("cpu")
    
    print(f"Using device: {device}")
    
    model = CSRNet().to(device)
    try:
        state = torch.load("csrnet_pretrained.pth", map_location=device)
        model.load_state_dict(state)
        model.eval()
        print("Loaded pretrained CSRNet weights")
    except Exception as e:
        print(f"Error loading model weights: {e}")
        # Continue without model for testing connectivity if needed, or raise
        # raise e
    
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
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

# Global state for the streaming thread
streaming_active = False
thread = None
thread_lock = threading.Lock()

# MJPEG State
outputFrame = None
frame_lock = threading.Lock()

def generate_heatmap_data(frame):
    """
    Run CSRNet, get density map, and downsample for frontend grid.
    Returns:
        heatmap_grid: List of values (0-1 normalized) for 60x40 grid
        stats: Dict with total_count, density_level, risk_level
    """
    # Resize for inference speed
    target_w, target_h = 640, 360
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    rgb_resized = cv2.resize(rgb, (target_w, target_h))
    
    img_tensor = transform(rgb_resized).unsqueeze(0).to(device)
    
    with torch.no_grad():
        density = model(img_tensor)
    
    density_map = density.squeeze().cpu().numpy()
    density_map = np.maximum(density_map, 0)
    
    total_count = np.sum(density_map)
    
    # Downsample to 60x40 grid for frontend
    grid_w, grid_h = 60, 40
    grid_map = cv2.resize(density_map, (grid_w, grid_h), interpolation=cv2.INTER_AREA)
    
    # Send raw density values (people count per cell)
    # Frontend will handle normalization and coloring (Jet colormap)
    heatmap_grid = grid_map.flatten().tolist()

    # Calculate max_val for stats
    max_val = np.max(grid_map)
    
    # Calculate Risk Level
    risk_level = "low"
    if total_count > 500 or max_val > 0.8: 
        risk_level = "critical"
    elif total_count > 300 or max_val > 0.5:
        risk_level = "high"
    elif total_count > 100:
        risk_level = "medium"
        
    stats = {
        "totalPeople": int(total_count),
        "globalDensity": float(min(total_count / 1000.0, 1.0)), 
        "globalRiskLevel": risk_level,
        "maxDensity": float(max_val)
    }
    
    return heatmap_grid, stats

def background_stream():
    """Background task to stream video and data."""
    global streaming_active, outputFrame
    print("Starting background stream...")
    
    cap = cv2.VideoCapture(RTMP_URL)
    while not cap.isOpened():
        print(f"Warning: Could not open RTMP {RTMP_URL}. Retrying in 5 seconds...")
        time.sleep(5)
        cap = cv2.VideoCapture(RTMP_URL)
        
    print(f"Successfully connected to RTMP stream: {RTMP_URL}")

    fps = 120
    frame_time = 1.0 / fps
    
    HEATMAP_INTERVAL = 1 # Run model every 3 frames
    frame_count = 0
    
    # Cache for skipping frames
    last_heatmap_grid = None
    last_stats = None
    
    while streaming_active:
        start_time = time.time()
        success, frame = cap.read()
        
        if not success:
            print("Video stream ended or failed, restarting...")
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0) # Loop if file
            continue
            
        frame_count += 1
        
        # Resize frame for transmission (save bandwidth)
        # 640x360 is decent for preview
        preview_frame = cv2.resize(frame, (640, 360))
        
        # 1. Process Heatmap (only every Nth frame)
        if frame_count % HEATMAP_INTERVAL == 0 or last_heatmap_grid is None:
            try:
                heatmap_grid, stats = generate_heatmap_data(frame)
                last_heatmap_grid = heatmap_grid
                last_stats = stats
                
                # Emit Data
                socketio.emit('heatmap_update', {
                    'grid': heatmap_grid,
                    'stats': stats,
                    'timestamp': time.time() * 1000
                })
            except Exception as e:
                print(f"Error in heatmap generation: {e}")
        
        # 2. Update MJPEG Frame (Every frame)
        # We encode here to ensure the generation thread just yields bytes
        ret, buffer = cv2.imencode('.jpg', preview_frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
        if ret:
            with frame_lock:
                outputFrame = buffer.tobytes()
            
        # Maintain FPS
        elapsed = time.time() - start_time
        delay = max(0, frame_time - elapsed)
        socketio.sleep(delay)
        
    cap.release()
    print("Background stream stopped.")

def generate():
    """Video streaming generator function."""
    global outputFrame
    while True:
        with frame_lock:
            if outputFrame is None:
                time.sleep(0.1) # Prevent CPU spin
                continue
            # Create a copy to yield
            frame_data = outputFrame
            
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_data + b'\r\n')
        
        # Limit yield rate slightly to prevent CPU spin if no new frame? 
        # Actually standard MJPEG implementations just yield as fast as possible or wait for new frame.
        # Since we are pulling from a global variable updated by another thread, 
        # we should sleep a tiny bit to match FPS roughly or use an event.
        # For simplicity, sleep matches ~30fps
        time.sleep(0.03)

@app.route('/video_feed')
def video_feed():
    response = Response(generate(), mimetype='multipart/x-mixed-replace; boundary=frame')
    response.headers.add('Access-Control-Allow-Origin', '*')
    return response

@socketio.on('connect')
def handle_connect():
    global thread, streaming_active
    print('Client connected')
    with thread_lock:
        if thread is None:
            streaming_active = True
            thread = socketio.start_background_task(background_stream)

@socketio.on('disconnect')
def handle_disconnect():
    print('Client disconnected')
    # Optional: Stop stream if no clients? 
    # For now, keep running or manage via a counter if needed.

@app.route('/')
def index():
    return "CrowdWatch WebSocket Server Running"

if __name__ == '__main__':
    # Use 0.0.0.0 to allow external connections
    print("Starting Flask-SocketIO server on port 5000...")
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)
