# System Architecture

## Overview
This backend system is a Flask-based application that streams video (from drones, webcams, or files) and applies **CSRNet** (Congested Scene Recognition Network) to generate real-time crowd density heatmaps.

## Key Components

### 1. Application Entry Point (`master.py`)
This is the core of the system.
- **Web Server**: Uses `Flask` + `Flask-SocketIO` to serve content and handle real-time bi-directional communication.
- **Async Mode**: patched with `eventlet` for concurrent handling of video frames and web requests.
- **Background Thread**: Runs a `background_stream()` function that:
    1.  Reads frames from the active `cv2.VideoCapture`.
    2.  Resizes frames for optimization.
    3.  Passes frames to the AI model (`generate_heatmap_data`).
    4.  Emits `heatmap_update` events via SocketIO to the frontend.
    5.  Updates a global MJPEG buffer for the `/video_feed` endpoint.

### 2. AI Model (`model.py`)
- **Architecture**: pre-trained VGG16 frontend + dilated convolution backend.
- **Function**: Takes a single image frame, outputs a density map.
- **Integration**: `master.py` normalizes the input, runs the model, and then downsamples the output density map to a 60x40 grid for efficient frontend rendering actions.

### 3. Data Flow
1.  **Input**: Video Source (RTMP URL, Webcam, or Uploaded MP4).
2.  **Processing**: `background_stream` captures frame -> `generate_heatmap_data` (Inference).
3.  **Output**:
    - **SocketIO**: emits `{ grid: [], stats: { totalPeople, riskLevel } }`.
    - **MJPEG**: standard video stream available at `/video_feed`.

### 4. API Endpoints
- **`/upload_video`**: Handles file uploads to `uploads/` directory.
- **`/set_source`**: Changes the active video input dynamically.
- **`/stop_stream`**: Halts the background processing thread.

## Configuration
- **`RTMP_URL`**: Hardcoded in `master.py` (line 22) for drone connection. Update this if your drone IP changes.
- **Device**: Automatically selects `cuda`, `mps` (Mac), or `cpu`.
