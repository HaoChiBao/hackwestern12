# LiveKit Ingress Guide

This document explains how to create and use a LiveKit Ingress (RTMP) for streaming drone footage into the application.

## 1. What is Ingress?

LiveKit Ingress allows standard RTMP streams (like from OBS, DJI Drones, or ffmpeg) to be published into a LiveKit room as a participant. It acts as a bridge:

`Drone (RTMP)` -> `LiveKit Ingress` -> `LiveKit Room (WebRTC)` -> `Frontend`

## 2. Prerequisites

Ensure your `.env` in `CSRNet-pytorch/` has:
- `LIVEKIT_URL` (wss://...livekit.cloud)
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`

## 3. Creating an Ingress Resource

You only need to do this **once** per persistent stream (or per event).

### Option A: CLI Script (Recommended)
Run the helper script from the `CSRNet-pytorch` directory:

```bash
python scripts/create_livekit_ingress.py --room default-room
```

**Output:**
```
--- INGRESS CREATED SUCCESSFULLY ---
Ingress ID:  IN_xxxxxx
RTMP URL:    rtmp://...
Stream Key:  sk_...
----------------------------------------
FULL PUBLISH URL (Put this in .env):
rtmp://<url>/<key>
----------------------------------------
```

### Option B: API Endpoint
Send a POST request to your running backend:

```bash
curl -X POST http://localhost:8000/api/livekit/ingress/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer hackwestern_debug_secret" \
  -d '{"room": "default-room"}'
```

*(Note: Change `hackwestern_debug_secret` if you set `ADMIN_DEBUG_TOKEN` in .env)*

## 4. Configuring the Backend

1. Copy the **FULL PUBLISH URL** from step 3.
2. Edit `CSRNet-pytorch/.env`.
3. Set `LIVEKIT_INGRESS_RTMP_URL` to this value.

```ini
LIVEKIT_INGRESS_RTMP_URL=rtmp://global.ingress.livekit.cloud/ingress/sk_123456...
```

## 5. Streaming

Once configured, use the restream script to push the drone feed:

```bash
./scripts/restream_drone_to_livekit.sh
```

This script reads from `DRONE_RTMP_INPUT_URL` and pushes to `LIVEKIT_INGRESS_RTMP_URL`.
