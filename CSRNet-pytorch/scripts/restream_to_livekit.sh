#!/bin/bash
# Script to restream RTMP input to LiveKit Ingress
# Usage: ./restream_to_livekit.sh [INPUT_RTMP] [INGRESS_RTMP]

INPUT=${1:-$DRONE_RTMP_INPUT_URL}
OUTPUT=${2:-$LIVEKIT_INGRESS_RTMP_URL}

if [ -z "$INPUT" ] || [ -z "$OUTPUT" ]; then
  echo "Usage: $0 <input_rtmp_url> <livekit_ingress_url>"
  echo "Or set DRONE_RTMP_INPUT_URL and LIVEKIT_INGRESS_RTMP_URL env vars."
  exit 1
fi

echo "Starting restream from $INPUT to $OUTPUT"

# Use ffmpeg to copy the stream without re-encoding (latency optimized)
# If codecs are incompatible, change -c copy to -c:v libx264 -preset ultrafast
ffmpeg -i "$INPUT" \
  -c copy \
  -f flv \
  "$OUTPUT"
