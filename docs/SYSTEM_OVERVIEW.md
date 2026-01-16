# System Overview: Local Drone Streaming Stack

## 1. What is this?
This is a **Local-First Real-Time Crowd Analysis System**. 
Previously, we relied on a cloud service (LiveKit) for video streaming. We have replaced this with a **self-hosted local stack** to ensure:
- Zero dependency on external internet/cloud keys.
- Lower latency on local networks.
- Full control over the video pipeline.

## 2. Architecture

### The Pipeline
```mermaid
graph LR
    A[DJI Drone] -- RTMP (H.264) --> B(MediaMTX Server)
    B -- WebRTC --> C[Frontend (React)]
    B -- RTMP Reading --> D[Backend (Python/CSRNet)]
    D -- Socket.IO (Analytics) --> C
```

### Components
1.  **MediaMTX (The Media Server)**
    - Runs in a Docker container.
    - **Ingest**: Listens on port `1935` for incoming RTMP streams.
    - **Output**: Converts RTMP to WebRTC (port `8889`) for the browser.
    - **Role**: The central hub for all video traffic.

2.  **Frontend (React App)**
    - **Role**: Visualization Dashboard.
    - **Video**: Embeds a WebRTC player (iframe) directly from MediaMTX.
    - **Data**: Receives real-time crowd heatmap data from the Backend via Socket.IO.
    - **Status**: Queries the Backend to know *where* to connect (dynamic URLs).

3.  **Backend (CSRNet-pytorch)**
    - **Role**: AI Inference & API.
    - **Video Access**: Connects to the configured RTMP URL (defaulting to MediaMTX) to read frames.
    - **Inference**: Runs CSRNet on frames to generate density maps.
    - **API**: Provides `/api/stream/info` so the frontend knows the MediaMTX addresses.

## 3. Key Changes from Old System
| Feature | Old (LiveKit) | New (MediaMTX) |
| :--- | :--- | :--- |
| **Ingsest** | Cloud/Internet Ingress URL | Local IP (e.g., `192.168.1.50`) |
| **Playback** | LiveKit Client SDK | Standard WebRTC / Iframe |
| **Token Auth** | JWT Tokens required | Open / IP-based (Simplified) |
| **Dependency** | External Internet | Local Wi-Fi Only |

## 4. Data Flow
1.  **Start**: Developer runs `./scripts/dev_up.sh`.
2.  **Connect**: Pilot connects Drone to `rtmp://<LAN_IP>:1935/dji`.
3.  **Stream**: MediaMTX receives video, makes it available on localhost.
4.  **Watch**: User opens Frontend. Frontend asks Backend "Where is the stream?". Backend says "Go to `http://localhost:8889/dji`".
5.  **Analyze**: Backend reads the same RTMP stream, counts people, and pushes data to Frontend.
