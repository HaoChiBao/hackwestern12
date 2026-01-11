#!/bin/bash
# Restream Drone RTMP to LiveKit Ingress
# Env Vars: DRONE_RTMP_INPUT_URL, LIVEKIT_INGRESS_RTMP_URL

INPUT="${DRONE_RTMP_INPUT_URL}"
OUTPUT="${LIVEKIT_INGRESS_RTMP_URL}"

if [ -z "$INPUT" ] || [ -z "$OUTPUT" ]; then
    echo "Error: Please set DRONE_RTMP_INPUT_URL and LIVEKIT_INGRESS_RTMP_URL"
    echo "Usage: DRONE_RTMP_INPUT_URL=... LIVEKIT_INGRESS_RTMP_URL=... ./restream_drone_to_livekit.sh"
    exit 1
fi

echo "Stream Source: $INPUT"
echo "Stream Target: LiveKit Ingress"

# ffmpeg copy for low latency
ffmpeg -i "$INPUT" \
    -c copy \
    -f flv \
    "$OUTPUT"
