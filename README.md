# Crowd Analysis Drone Stream

This project provides real-time crowd analysis using a drone video feed.
The stack consists of:
- **MediaMTX**: Local RTMP ingest & WebRTC streaming server.
- **CSRNet-pytorch**: Python backend for AI inference and stream info.
- **Frontend**: React application for visualization.

## Quick Start

### 1. Prerequisites
- Docker & Docker Compose
- Node.js & npm
- Python 3.9+

### 2. Start Everything
Run the helper script for your OS:

**Mac/Linux:**
```bash
./scripts/dev_up.sh
```

**Windows (PowerShell):**
```powershell
./scripts/dev_up.ps1
```

This will:
1. Start MediaMTX in Docker (Background).
2. Ask if you want to run Backend & Frontend (Foreground/New Windows).

### 1. Start the Stack (Mac/Linux)
```bash
./scripts/dev_up.sh
```
*This starts MediaMTX (RTMP Server), Backend, and Frontend.*

**Verification:**
After running the script, verify that the media server is up:
```bash
lsof -i :1935
```
*You should see `mediamtx` listening on port 1935.*

### 2. Connect Drone
1.  Connect your DJI drone to the **Same Wi-Fi** as your computer.
2.  Open the dashboard at `http://<YOUR_LAN_IP>:3000`.
3.  Copy the **RTMP Ingest URL** (e.g., `rtmp://192.168.1.16:1935/dji`).
4.  Paste it into the DJI App (RTMP Streaming).
5.  Start Streaming.

**Note on Backend Logs:**
You may see warnings like `[WARN] RTMP server not reachable...` if the media server is not up yet. This is normal. The backend will retry automatically.
- **Frontend**: Open `http://localhost:3000` (or `http://<LAN_IP>:3000` from another device).
- **Direct Player**: `http://localhost:8889/dji`

## Ports Usage
- **1935**: RTMP Ingest (Input)
- **8889**: WebRTC Playback (Output)
- **8000**: Backend API
- **3000**: Frontend

## Troubleshooting
- **No Video?** Ensure DJI is sending **H.264** video (not H.265).
- **Connection Failed?** Ensure Firewall allows ports 1935 and 8889.
