# Getting Started

## 1. Prerequisites
- **Python 3.8+**
- **CUDA Toolkit** (optional, for GPU acceleration)

## 2. Setup Environment
Open a terminal in this directory and run:

```bash
# Create a virtual environment
python -m venv venv

# Activate on Windows
venv\Scripts\activate

# Activate on Mac/Linux
source venv/bin/activate
```

## 3. Install Dependencies
```bash
pip install -r requirements.txt
```

## 4. Download Model Weights
**Critical**: You must obtain the file `csrnet_pretrained.pth` and place it in this root directory.
Without this file, the heatmap generation will function in a "fallback" mode returning dummy data.

## 5. Run the Server
The main entry point is `master.py`.

```bash
python master.py
```

The server will start on `http://0.0.0.0:5000`.

## 6. Usage
- **Web Interface**: The server exposes a SocketIO interface.
- **REST Endpoints**:
    - `POST /upload_video`: Upload a video file to stream.
    - `POST /set_source`: Switch between 'drone' (RTMP), 'webcam', or 'upload'.
    - `POST /stop_stream`: Stop the current stream.
    - `GET /video_feed`: MJPEG stream validation endpoint.
