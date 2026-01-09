import cv2
import time
import numpy as np
import torch

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
torch.set_grad_enabled(False)
print("Loaded pretrained CSRNet weights")

# ----------------------
# RTMP Video Source
# ----------------------
RTMP_URL = "rtmp://192.168.2.90:1935/live/dji"   # drone livestream
print(f"Opening RTMP stream: {RTMP_URL}")

cap = cv2.VideoCapture(RTMP_URL)

# Try to keep buffer small (reduce latency)
cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

if not cap.isOpened():
    print("❌ ERROR: Could not open RTMP livestream. Start the drone stream first.")
    exit(1)

print("✅ RTMP stream opened successfully")

# ----------------------
# Global buffer for temporal smoothing
# and last heatmap/info
# ----------------------
prev_density = None
last_heatmap = None
last_est_count = 0.0
last_fps = 0.0

# How often to run CSRNet (every Nth frame)
INFER_EVERY = 5   # you can try 1 for max responsiveness, 3–5 for speed


def build_smooth_heatmap(density, frame_shape):
    """
    Turn a raw density map into a smooth, stable, non-pixelated HEATMAP IMAGE
    (no blending with frame here).
    """
    global prev_density

    # ---- Temporal smoothing ----
    if prev_density is None:
        smooth_density = density
    else:
        smooth_density = 0.7 * prev_density + 0.3 * density

    prev_density = smooth_density

    # ---- Spatial smoothing ----
    smooth_density = cv2.GaussianBlur(smooth_density, (0, 0), sigmaX=3, sigmaY=3)

    # ---- Robust normalization ----
    vmin = 0.0
    vmax = np.percentile(smooth_density, 99)

    if vmax <= vmin:
        norm = np.zeros_like(smooth_density, dtype=np.float32)
    else:
        clipped = np.clip(smooth_density, vmin, vmax)
        norm = (clipped - vmin) / (vmax - vmin + 1e-8)

    norm_8u = (norm * 255).astype(np.uint8)

    # ---- Colorize ----
    heatmap_small = cv2.applyColorMap(norm_8u, cv2.COLORMAP_JET)

    # ---- Upscale to match frame size ----
    h, w, _ = frame_shape
    heatmap = cv2.resize(
        heatmap_small,
        (w, h),
        interpolation=cv2.INTER_CUBIC
    )

    return heatmap


def run_model_on_frame(frame):
    """Run CSRNet on BGR frame and return (heatmap_image, est_count, fps)."""
    img_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

    tensor = torch.from_numpy(img_rgb).permute(2, 0, 1).unsqueeze(0).float() / 255.0
    tensor = tensor.to(device)

    start = time.time()
    density_map = model(tensor)
    infer_time = time.time() - start

    density = density_map.squeeze().cpu().numpy()
    est_count = float(density.sum())
    fps = 1.0 / infer_time if infer_time > 0 else 0.0

    heatmap = build_smooth_heatmap(density, frame.shape)

    return heatmap, est_count, fps


print("🎥 Starting live CSRNet processing… Press Q to quit.")

frame_idx = 0

# ----------------------
# Main loop
# ----------------------
while True:
    ret, frame = cap.read()

    if not ret or frame is None:
        # No artificial sleep here – just try again next loop
        print("⚠ No RTMP frame yet…")
        continue

    frame_idx += 1

    # Every Nth frame: run the model & update the heatmap
    if frame_idx % INFER_EVERY == 0:
        try:
            heatmap, est_count, fps = run_model_on_frame(frame)
            last_heatmap = heatmap
            last_est_count = est_count
            last_fps = fps
        except Exception as e:
            print(f"⚠ Error during model inference: {e}")

    # If we have a heatmap, overlay it on the CURRENT live frame
    if last_heatmap is not None:
        if last_heatmap.shape[:2] != frame.shape[:2]:
            last_heatmap = cv2.resize(
                last_heatmap,
                (frame.shape[1], frame.shape[0]),
                interpolation=cv2.INTER_CUBIC
            )

        overlay = cv2.addWeighted(frame, 0.55, last_heatmap, 0.45, 0)
    else:
        overlay = frame.copy()

    # Draw text using the LAST model output
    cv2.putText(
        overlay, f"Estimated count: {last_est_count:.1f}",
        (20, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.8,
        (255, 255, 255), 2
    )
    cv2.putText(
        overlay, f"Model FPS (every {INFER_EVERY}): {last_fps:.2f}",
        (20, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.8,
        (255, 255, 255), 2
    )

    cv2.imshow("CSRNet Live Heatmap", overlay)

    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

cap.release()
cv2.destroyAllWindows()
