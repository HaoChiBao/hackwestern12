import time
import torch
import numpy as np
from model import CSRNet  # from this repo

# Choose device
if torch.backends.mps.is_available():
    device = torch.device("mps")   # Apple Silicon GPU (Metal)
elif torch.cuda.is_available():
    device = torch.device("cuda")
else:
    device = torch.device("cpu")

print("Using device:", device)

# Create model and move to device
model = CSRNet().to(device)
model.eval()

# Fake image: 720p RGB
h, w = 720, 1280
dummy = np.random.rand(3, h, w).astype(np.float32)
tensor = torch.from_numpy(dummy).unsqueeze(0).to(device)  # shape (1,3,H,W)

# Warm-up
with torch.no_grad():
    _ = model(tensor)

# Time a few runs
iters = 5
start = time.time()
with torch.no_grad():
    for _ in range(iters):
        out = model(tensor)
end = time.time()

density = out[0, 0].cpu().numpy()
estimated_count = density.sum()

print("Output density map shape:", out.shape)
print("Estimated count (random weights):", estimated_count)
print(f"Avg time per frame: {(end - start) / iters:.3f} seconds")
