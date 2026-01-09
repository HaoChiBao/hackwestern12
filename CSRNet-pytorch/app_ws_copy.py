import base64
import cv2
import time
import numpy as np
import torch
import os

from flask import Flask, render_template
from flask_socketio import SocketIO

from model import CSRNet

# ----------------------
# Device selection
# ----------------------
if torch.backends.mps.is_available():
    device = torch.device("mps")
elif torch.cuda.is_available():
    device = torch.device("cuda")
else:
    device = torch.device("cpu")

print("Using device:", device)

# ----------------------
# Load model + weights
# ----------------------
model = CSRNet().to(device)
state = torch.load("csrnet_pretrained.pth", map_location=device)
model.load_state_dict(state)
model.eval()
print("Loaded pretrained CSRNet weights")

# ----------------------
# Video source (RTMP or local file)
# ----------------------

# Your PC's IP for RTMP streaming from DJI Fly:
DEFAULT_RTMP_URL = "rtmp://192.168.2.90:1935/live/dji"

# Fallback file for testing
DEFAULT_FILE = "crowd.mp4"

# Choose source:
#   - Set VIDEO_SOURCE env var externally, OR
#   - Hardcode here for development
VIDEO_SOURCE = os.getenv("VIDEO_SOURCE", DEFAULT_RTMP_URL)   # switch to DEFAULT_RTMP_URL when ready

print(f"[Video] Using source: {VIDEO_SOURCE}")

cap = None


def open_capture():
    """Open or reopen the video capture device."""
    global cap

    # Release old capture if any
    if cap is not None:
        try:
            cap.release()
        except:
            pass

    print(f"[Video] Opening capture: {VIDEO_SOURCE}")
    cap = cv2.VideoCapture(VIDEO_SOURCE)

    if not cap.isOpened():
        print("❌ ERROR: Could not open VIDEO_SOURCE. If RTMP, start DJI live streaming.")
    else:
        print("✅ Video capture opened successfully.")


# ----------------------
# Flask + SocketIO setup
# ----------------------
app = Flask(__name__)
app.config["SECRET_KEY"] = "secret!"
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="eventlet")

stream_thread = None
stream_running = False

# ----------------------
# Global buffer for temporal smoothing
# ----------------------
prev_density = None


def build_smooth_heatmap(density, orig_frame):
    """
    Turn a raw density map into a smooth, stable, non-pixelated overlay.
    """
    global prev_density

    # ---- Temporal smoothing (reduces flicker) ----
    if prev_density is None:
        smooth_density = density
    else:
        # 0.7 previous + 0.3 current → more stable
        smooth_density = 0.7 * prev_density + 0.3 * density

    prev_density = smooth_density

    # ---- Spatial smoothing (reduces speckle / pixel noise) ----
    smooth_density = cv2.GaussianBlur(smooth_density, (0, 0), sigmaX=3, sigmaY=3)

    # ---- Robust normalization (avoid sudden color jumps) ----
    vmin = 0.0
    vmax = np.percentile(smooth_density, 99)  # ignore top 1% spikes

    if vmax <= vmin:
        norm = np.zeros_like(smooth_density, dtype=np.float32)
    else:
        clipped = np.clip(smooth_density, vmin, vmax)
        norm = (clipped - vmin) / (vmax - vmin + 1e-8)

    norm_8u = (norm * 255).astype(np.uint8)

    # ---- Apply colormap ----
    heatmap_small = cv2.applyColorMap(norm_8u, cv2.COLORMAP_JET)

    # ---- High-quality upscale so it’s NOT pixelated ----
    heatmap = cv2.resize(
        heatmap_small,
        (orig_frame.shape[1], orig_frame.shape[0]),
        interpolation=cv2.INTER_CUBIC
    )

    # ---- Blend with original frame ----
    overlay = cv2.addWeighted(orig_frame, 0.55, heatmap, 0.45, 0)

    return overlay


def process_frame(frame):
    """Run CSRNet + overlay heatmap on a single BGR frame."""
    # BGR -> RGB for the model
    img_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

    tensor = torch.from_numpy(img_rgb).permute(2, 0, 1).unsqueeze(0).float() / 255.0
    tensor = tensor.to(device)

    start = time.time()
    with torch.no_grad():
        density_map = model(tensor)
    infer_time = time.time() - start

    # density_map: (1,1,H,W) -> (H,W)
    density = density_map.squeeze().cpu().numpy()
    est_count = float(density.sum())

    # Build smoothed, nice-looking overlay
    overlay = build_smooth_heatmap(density, frame)

    fps = 1.0 / infer_time if infer_time > 0 else 0.0

    text1 = f"Estimated count: {est_count:.1f}"
    text2 = f"FPS: {fps:.2f}"
    cv2.putText(overlay, text1, (20, 30),
                cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)
    cv2.putText(overlay, text2, (20, 60),
                cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)

    return overlay, est_count, fps


def stream_frames():
    global stream_running, cap
    print("🚀 Stream thread started")

    # Open capture at start
    if cap is None or not cap.isOpened():
        open_capture()

    while stream_running:

        # If capture is not open (e.g., RTMP not started yet), retry
        if cap is None or not cap.isOpened():
            print("[Stream] Capture not open. Retrying in 1s...")
            socketio.sleep(1)
            open_capture()
            continue

        success, frame = cap.read()

        # RTMP case: stream not started yet or dropped
        if VIDEO_SOURCE.startswith("rtmp://"):
            if not success or frame is None:
                print("[Stream] No RTMP frame yet... waiting...")
                socketio.sleep(0.5)
                continue

        # File case: loop video
        if not success:
            print("[Stream] End of file reached — looping video.")
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            continue

        # ---- Your CSRNet processing ----
        overlay, est_count, fps = process_frame(frame)

        # Encode and emit
        ret, buffer = cv2.imencode(".jpg", overlay)
        if not ret:
            print("[Stream] JPEG encode failed.")
            continue

        jpg_as_text = base64.b64encode(buffer).decode("utf-8")

        socketio.emit("frame", {
            "image": jpg_as_text,
            "count": est_count,
            "fps": fps,
        })

        socketio.sleep(0)



@app.route("/")
def index():
    return render_template("index_ws.html")


@socketio.on("connect")
def handle_connect():
    global stream_thread, stream_running
    print("🌐 Client connected")
    if not stream_running:
        stream_running = True
        stream_thread = socketio.start_background_task(stream_frames)


@socketio.on("disconnect")
def handle_disconnect():
    print("❌ Client disconnected")
    # keep stream_running = True so video continues for others


if __name__ == "__main__":
    print("✅ Starting SocketIO server on http://127.0.0.1:5000 ...")
    socketio.run(app, host="127.0.0.1", port=5000, debug=True)
