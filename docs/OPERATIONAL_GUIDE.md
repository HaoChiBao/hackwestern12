# Operational Guide: How to Run the System

## 1. Prerequisites
- **Computer**: Mac, Linux, or Windows (WSL/PowerShell).
- **Network**: A local Wi-Fi network (Hotspot or Router) that both the **Computer** and **Phone/Drone** are connected to.
- **Software**: Docker Desktop, Node.js, Python 3.9+.

## 2. Startup Procedure

We have created one-click scripts to start the entire stack (Media Server + Backend + Frontend).

### Step 1: Launch the Stack
**On Mac/Linux:**
```bash
cd /path/to/repo
./scripts/dev_up.sh
```

**On Windows:**
```powershell
cd \path\to\repo
./scripts/dev_up.ps1
```

1.  The script will start **MediaMTX** in the background (Docker).
2.  It will ask if you want to start the **Backend & Frontend**. Type `y`.
    - **Backend** will launch in a terminal window/process.
    - **Frontend** will launch in a terminal window/process.

### Step 2: Connect the Drone (RTMP)
The drone needs to send video to your computer.

1.  **Find your Computer's Local IP**:
    - **Mac**: `ipconfig getifaddr en0` (usually `192.168.x.x` or `172.20.x.x`).
    - **Windows**: `ipconfig` (Look for IPv4 Address).
2.  **Configure Drone (DJI Fly App)**:
    - Go to **Settings** -> **Camera** -> **RTMP Streaming**.
    - Resolution: **720p** or **1080p** (720p recommended for lower latency).
    - Bitrate: **2 Mbps** (recommended).
    - **URL**: `rtmp://<YOUR_COMPUTER_IP>:1935/dji`
    - Start Streaming.

> [!IMPORTANT]
> **Video Codec Warning**: Ensure the drone is set to **H.264**. 
> If using H.265 (HEVC), the browser might not display the video, although the backend might still process it.

### Step 3: View & Analyze
1.  Open your browser to `http://localhost:3000` (or `http://<YOUR_COMPUTER_IP>:3000` on another device).
2.  You should see the video feed immediately.
3.  Heatmap overlays will appear as the backend processes frames.

---

## 3. Configuration & Ports

| Service | Port | Protocol | Usage |
| :--- | :--- | :--- | :--- |
| **MediaMTX** | `1935` | TCP (RTMP) | Drone Input |
| **MediaMTX** | `8889` | UDP/TCP (WebRTC)| Browser Playback |
| **MediaMTX** | `8888` | TCP (HLS/API) | Debugging / Status |
| **Backend** | `8000` | HTTP/WS | API & Analytics Data |
| **Frontend** | `3000` | HTTP | User Interface |

### Modifying Configuration
- **Media Server**: Edit `mediamtx.yml`.
- **Backend Stream Source**: Edit `CSRNet-pytorch/master.py` (Env var `DRONE_RTMP_INPUT_URL`).

---

## 4. Troubleshooting

**"I see the dashboard, but the video is black/loading."**
- Check if the drone is actually streaming (Does the DJI app say "Live"?).
- Check if your computer firewall is blocking port `1935` or `8889`.
- Open `http://localhost:8889/dji` directly in a new tab. If this fails, MediaMTX isn't receiving data.

**"The video works, but no heatmaps."**
- Check the Backend terminal output.
- Does it say `[DEBUG] Processed X frames`?
- If it says `RTMP source not ready`, the backend can't connect to MediaMTX. Ensure `rtmp://localhost:1935/dji` is correct.

**"Docker failed to start."**
- Ensure Docker Desktop is running.
- Run `docker ps` to see if `mediamtx` is listed.
- If port `1935` is already in use, stop other services or change the port in `docker-compose.yml`.
