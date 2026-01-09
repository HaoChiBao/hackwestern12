import cv2
import numpy as np
import torch
from torchvision import transforms
from flask import Flask, Response, render_template_string

from model import CSRNet  # assumes model.py is in the same folder

# ----------------------
# RTMP Video Source
# ----------------------
RTMP_URL = "rtmp://192.168.2.90:1935/live/dji"  # your drone stream

cap = cv2.VideoCapture(RTMP_URL)
if not cap.isOpened():
    raise RuntimeError(f"Could not open RTMP stream: {RTMP_URL}")

# ----------------------
# Device + Model Setup
# ----------------------
if torch.backends.mps.is_available():
    device = torch.device("mps")
elif torch.cuda.is_available():
    device = torch.device("cuda")
else:
    device = torch.device("cpu")

print("Using device:", device)

model = CSRNet().to(device)
state = torch.load("csrnet_pretrained.pth", map_location=device)
model.load_state_dict(state)
model.eval()
print("Loaded pretrained CSRNet weights")

# ImageNet-style preprocessing (adjust if your training used something else)
transform = transforms.Compose([
    transforms.ToTensor(),  # HWC [0,255] -> CHW [0,1]
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    )
])

app = Flask(__name__)

# ----------------------
# HTML template
# ----------------------
HTML_PAGE = """
<!doctype html>
<html>
  <head>
    <title>CrowdWatch Live</title>
    <style>
      body {
        background: #020617;
        color: #e5e7eb;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        margin: 0;
      }
      h1 {
        margin-bottom: 0.5rem;
      }
      p {
        margin-top: 0;
        margin-bottom: 1.5rem;
        opacity: 0.8;
      }
      .video-container {
        border-radius: 16px;
        overflow: hidden;
        box-shadow: 0 10px 40px rgba(0,0,0,0.6);
        max-width: 90vw;
        max-height: 80vh;
      }
      img {
        width: 100%;
        height: auto;
        display: block;
      }
    </style>
  </head>
  <body>
    <h1>CrowdWatch – Heatmap View</h1>
    <p>Live drone feed with CSRNet density heatmap overlay.</p>
    <div class="video-container">
      <img src="{{ url_for('video_heatmap') }}" alt="Heatmap stream">
    </div>
  </body>
</html>
"""

@app.route("/")
def index():
    # Main page – just shows the heatmap stream
    return render_template_string(HTML_PAGE)


# ==========================================================
# ORIGINAL RAW STREAM VERSION (COMMENTED OUT FOR REFERENCE)
# ==========================================================
#
# def gen_frames():
#     """Raw video streaming generator (no heatmap)."""
#     while True:
#         success, frame = cap.read()
#         if not success:
#             break
#
#         ret, buffer = cv2.imencode('.jpg', frame)
#         if not ret:
#             continue
#
#         frame_bytes = buffer.tobytes()
#         yield (b'--frame\\r\n'
#                b'Content-Type: image/jpeg\\r\n\\r\n' + frame_bytes + b'\\r\n')
#
# @app.route("/video_feed")
# def video_feed():
#     return Response(
#         gen_frames(),
#         mimetype="multipart/x-mixed-replace; boundary=frame"
#     )


# ==========================================================
# HEATMAP VERSION
# ==========================================================
def generate_heatmap_overlay(frame):
    """
    Run CSRNet on the frame and overlay the density heatmap.
    Returns a BGR frame suitable for JPEG encoding.
    """
    # Convert to RGB (OpenCV is BGR by default)
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

    # Optional: resize to smaller size for speed (CSRNet is heavy)
    # Make sure H and W are divisible by 8 for CSRNet
    target_w = 640
    target_h = 360
    rgb = cv2.resize(rgb, (target_w, target_h))

    # Preprocess for model
    img_tensor = transform(rgb).unsqueeze(0).to(device)  # shape: (1, 3, H, W)

    with torch.no_grad():
        density = model(img_tensor)  # shape: (1, 1, H', W') typically

    # Convert density map to numpy
    density_map = density.squeeze().cpu().numpy()  # (H', W')

    # Make sure it's non-negative and not all zeros
    density_map = np.maximum(density_map, 0)

    if density_map.max() > 0:
        density_norm = density_map / density_map.max()
    else:
        density_norm = density_map

    density_norm = (density_norm * 255).astype(np.uint8)

    # Resize density map to match original (resized) frame size
    density_color = cv2.applyColorMap(density_norm, cv2.COLORMAP_JET)
    density_color = cv2.resize(density_color, (rgb.shape[1], rgb.shape[0]))

    # Convert RGB back to BGR for OpenCV display
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)

    # Blend original frame + heatmap
    overlay = cv2.addWeighted(bgr, 0.6, density_color, 0.4, 0)

    return overlay


def gen_frames_heatmap():
    """Video streaming generator that sends heatmap-overlaid frames."""
    while True:
        success, frame = cap.read()
        if not success:
            break

        # Run CSRNet + overlay
        heatmap_frame = generate_heatmap_overlay(frame)

        # Encode as JPEG
        ret, buffer = cv2.imencode('.jpg', heatmap_frame)
        if not ret:
            continue

        frame_bytes = buffer.tobytes()

        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')


@app.route("/video_heatmap")
def video_heatmap():
    return Response(
        gen_frames_heatmap(),
        mimetype="multipart/x-mixed-replace; boundary=frame"
    )


if __name__ == "__main__":
    # host="0.0.0.0" lets you open it from other devices on your LAN too
    app.run(host="0.0.0.0", port=5000, debug=False, threaded=True)
