#!/bin/bash

# Start MediaMTX in background
echo "Starting MediaMTX via Docker Compose..."
docker compose up -d mediamtx

# Check if Docker started successfully
if [ $? -ne 0 ]; then
    echo "Error: Docker Compose failed to start."
    exit 1
fi

echo "MediaMTX is running on:"
echo "  - RTMP Ingest: rtmp://localhost:1935/dji"
echo "  - WebRTC Play: http://localhost:8889/dji"

# Option to start backend/frontend
echo ""
echo "Do you want to start the Backend and Frontend now? (y/n)"
read -r response

if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    echo "Starting Backend and Frontend..."
    
    # Store PIDs to kill them later
    trap 'kill $BACKEND_PID $FRONTEND_PID; exit' SIGINT SIGTERM

    # Start Backend
    echo "Starting Backend (CSRNet-pytorch/master.py)..."
    cd CSRNet-pytorch
    if [ -d ".venv" ]; then
        source .venv/bin/activate
    fi
    python master.py &
    BACKEND_PID=$!
    cd ..

    # Start Frontend
    echo "Starting Frontend (npm start)..."
    cd frontend
    npm start &
    FRONTEND_PID=$!
    cd ..

    echo "Services running. Press Ctrl+C to stop."
    wait
else
    echo "Done. You can run backend/frontend manually."
fi
