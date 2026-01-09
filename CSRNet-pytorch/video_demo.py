import cv2
import time
import numpy as np
import torch

from model import CSRNet  # from this repo

# --------------------------------------------------
# Device selection (MPS on Mac, CUDA on GPU, else CPU)
# --------------------------------------------------
if torch.backends.mps.is_available():
    device = torch.device("mps")
elif torch.cuda.is_available():
    device = torch.device("cuda")
else:
    device = torch.device("cpu")

print("Using device:", device)

# --------------------------------------------------
# Load CSRNet + pretrained weights
# --------------------------------------------------
model = CSRNet().to(device)

state = torch.load("csrnet_pretrained.pth", map_location=device)
model.load_state_dict(state)
print("Loaded pretrained CSRNet weights")

model.eval()

# --------------------------------------------------
# Video input
# --------------------------------------------------
video_path = "crowd.mp4"   # change this if needed
cap = cv2.VideoCapture(video_path)

if not cap.isOpened():
    print(f"Error: could not open video {video_path}")
    exit(1)

# Resize target for inference (change these if needed)
TARGET_H = 720
TARGET_W = 1280

# Skip frames to speed up inference
FRAME_SKIP = 1   # try 1, 2, or 3 depending on performance

frame_idx = 0
fps_history = []

# --------------------------------------------------
# GLOBAL buffer for temporal smoothing
# --------------------------------------------------
prev_density = None


def build_smooth_heatmap(density, orig_frame):
    global prev_density

    # ---- Temporal smoothing (reduces flicker) ----
    if prev_density is None:
        smooth_density = density
    else:
        smooth_density = 0.7 * prev_density + 0.3 * density

    prev_density = smooth_density

    # ---- Spatial smoothing (reduces pixel noise) ----
    smooth_density = cv2.GaussianBlur(smooth_density, (0, 0), sigmaX=3, sigmaY=3)

    # ---- Robust normalization (avoid sudden color jumps) ----
    vmin = 0.0
    vmax = np.percentile(smooth_density, 99)  # ignore top 1% spikes

    if vmax <= vmin:
        norm = np.zeros_like(smooth_density, dtype=np.float32)
    else:
        clipped = np.clip(smooth_density, vmin, vmax)
        norm = (clipped - vmin) / (vmax - vmin)

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


# --------------------------------------------------
# Main video loop
# --------------------------------------------------
while True:
    ret, frame = cap.read()
    if not ret:
        print("End of video.")
        break

    frame_idx += 1
    if frame_idx % FRAME_SKIP != 0:
        continue

    orig_frame = frame.copy()

    # Resize for CNN
    frame_resized = cv2.resize(frame, (TARGET_W, TARGET_H))

    # BGR → RGB
    img_rgb = cv2.cvtColor(frame_resized, cv2.COLOR_BGR2RGB)

    # To tensor
    tensor = torch.from_numpy(img_rgb).permute(2, 0, 1).unsqueeze(0).float() / 255.0
    tensor = tensor.to(device)

    # ---- CSRNet inference ----
    start_t = time.time()
    with torch.no_grad():
        density_map = model(tensor)
    infer_time = time.time() - start_t

    fps = 1.0 / infer_time if infer_time > 0 else 0.0
    fps_history.append(fps)

    density = density_map.squeeze().cpu().numpy()
    est_count = float(density.sum())

    # ---- Build improved heatmap ----
    overlay = build_smooth_heatmap(density, orig_frame)

    # ---- Text overlay ----
    text1 = f"Estimated count: {est_count:.1f}"
    text2 = f"FPS: {fps:.2f}"
    cv2.putText(overlay, text1, (20, 30),
                cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)
    cv2.putText(overlay, text2, (20, 60),
                cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)

    # ---- Show output ----
    cv2.imshow("CSRNet Crowd Density (Smooth Overlay)", overlay)
    key = cv2.waitKey(1) & 0xFF

    if key == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()

if fps_history:
    print(f"Average FPS: {sum(fps_history) / len(fps_history):.2f}")
