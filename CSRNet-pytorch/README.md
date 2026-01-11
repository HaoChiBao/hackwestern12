# CrowdWatch Backend (CSRNet-pytorch)

Real-time crowd analysis system using CSRNet (PyTorch) + LiveKit + AWS S3.

## Architecture

- **Compute**: Flask + SocketIO (Eventlet) on AWS EC2 (GPU).
- **Storage**: AWS S3 for uploaded videos.
- **Live Video**: LiveKit (WebRTC) for streaming Webcam and Drone feeds.
- **Analytics**: 
  - **Uploaded**: Processed on server via temp files, results sent via WebSocket.
  - **Drone**: Server reads RTMP stream directly for analytics; viewers watch via LiveKit.
  - **Webcam**: Visuals via LiveKit. Analytics currently require a bot subscriber (in progress).

## Setup

1. **Environment Variables**:
   Create `.env` based on `.env.example`:
   ```ini
   AWS_REGION=us-east-1
   S3_BUCKET=your-bucket-name
   # IAM Role preferred on EC2, keys optional for local
   AWS_ACCESS_KEY_ID=
   AWS_SECRET_ACCESS_KEY=

   LIVEKIT_URL=wss://...
   LIVEKIT_API_KEY=...
   LIVEKIT_API_SECRET=...
   
   DRONE_RTMP_INPUT_URL=rtmp://...
   LIVEKIT_INGRESS_RTMP_URL=rtmp://...
   ```

2. **Dependencies**:
   ```bash
   pip install -r requirements.txt # (if exists)
   # OR
   pip install flask flask-socketio eventlet boto3 livekit-api python-dotenv opencv-python-headless torchvision torch
   ```

3. **Running the Server**:
   ```bash
   python master.py
   ```

## Usage Flows

### 1. Uploaded Videos
- Frontend uploads file to `/api/upload`.
- Server saves to temp -> Uploads to S3 -> Returns Presigned URL.
- Server runs analytics on local temp file and emits events to `video_{videoId}` room.
- Events include `t_ms` to sync overlays with video playback time.

### 2. Drone Feed
- **Visuals**: Use the helper script to push drone RTMP to LiveKit.
  ```bash
  ./scripts/restream_drone_to_livekit.sh
  ```
- **Analytics**: The backend (`master.py`) automatically connects to `DRONE_RTMP_INPUT_URL` on startup to generate heatmaps.

### 3. Webcam
- Frontend publishes camera to LiveKit.
- Backend analytics for webcam are currently disabled (requires bot architecture).

## Deployment

- **EC2**: Ensure the instance has an IAM Role with `AmazonS3FullAccess`.
- **Model**: Place `csrnet_pretrained.pth` in the root or set `MODEL_PATH`.
