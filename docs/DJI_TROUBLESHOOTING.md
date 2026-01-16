# DJI Drone to LiveKit Troubleshooting

If your drone connects but you see **No Video** in the frontend, follow these steps.

## Common Issues

### 1. Codec Mismatch (H.265 vs H.264)
**Symptoms**:
- Frontend Debug Panel shows `TrackPublished: video`, but `isSubscribed: false` or video is black.
- Frontend logs show "Video track published" but browser cannot render it.

**Cause**:
- Many newer DJI drones default to **H.265 (HEVC)** to save bandwidth.
- Most browsers (Chrome/Edge) and LiveKit's web SDK have better compatibility with **H.264**.

**Fix**:
1.  Open DJI Pilot / Fly App.
2.  Go to **Camera Settings** -> **Video Format**.
3.  Change Coding Format from **H.265** to **H.264**.
4.  Restart the stream.

### 2. Auto-Subscribe Failure
**Symptoms**:
- Debug Panel shows `TrackPublished: video` (Source: camera).
- `isSubscribed` remains `false`.

**Cause**:
- The generic Room connection might not be auto-subscribing, or the token grants are missing `canSubscribe: true`.

**Fix**:
- Ensure the frontend `Room` option `autoSubscribe` is set to `true` (default is true).
- Check the Backend Token Generation (`master.py` or `livekit.py`) to ensure the viewer token has:
  ```python
  video_grants = VideoGrants(room_join=True, can_publish=false, can_subscribe=True)
  ```

### 3. RTMP vs RTMPS
**Symptoms**:
- Drone fails to connect entirely (Debug Panel: `Remotes: 0`).

**Cause**:
- DJI often fails SSL handshakes on `rtmps://`.

**Fix**:
- Use `rtmp://` (remove the 's') in the DJI RTMP Address field.

### 4. Keyframe Interval
**Symptoms**:
- Video appears but has huge delay (10s+) or artifacts.

**Fix**:
- In DJI Transmission settings, look for **Keyframe Interval** or **GOP**. Set it to **1 second** or **30 frames** if possible. LiveKit requires frequent keyframes for low latency.
