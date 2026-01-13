# Architecture 1: Direct Ingress (No Relay)

In this architecture, the DJI Drone streams **DIRECTLY** to the LiveKit Cloud Ingress. There is no local `ffmpeg` relay running on your laptop.

## Prerequisites
1.  **LiveKit Cloud Project**: You must have a LiveKit Cloud project.
2.  **Ingress Resource**: An RTMP Ingress resource must exist in your LiveKit project.
3.  **DJI Drone w/ RTMP Support**: Your drone controller must support "Custom RTMP".

## Configuration (`.env`)
Your `.env` file should have:
```ini
LIVE_MODE=direct_ingress
LIVEKIT_INGRESS_RTMP_URL=rtmps://<project-id>.rtmp.livekit.cloud/x/<stream-key>
```
*Note: `DRONE_RTMP_INPUT_URL` is IGNORED in this mode.*

## Usage Steps

### 1. Start the Application
Run the backend and frontend as usual.
```bash
# Backend
python master.py

# Frontend
npm start
```

### 2. Configure the Drone
1.  Open the Frontend in your browser (localhost:3000).
2.  Select **DRONE FEED** from the dropdown.
3.  You will see a **"Ready to Connect"** screen.
4.  Copy the **RTMP Publish URL** displayed there.
5.  In your DJI App (Fly App / Go 4):
    *   Go to **Settings** -> **Live Streaming Platform** -> **Custom RTMP**.
    *   Paste the URL.
    *   Start Streaming.

### 3. View the Stream
1.  Once the drone is streaming, click **"Connect to Stream"** in the Frontend.
2.  The video should appear!

## Troubleshooting
*   **"Waiting for stream..."**: Ensure the drone is actually streaming and has a good internet connection.
*   **Black Screen**: Check if the drone is sending video. Only "video" tracks are rendered.
*   **Latency**: LiveKit is generally <500ms. If higher, check drone connectivity.
