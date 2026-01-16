# Start MediaMTX in background
Write-Host "Starting MediaMTX via Docker Compose..."
docker compose up -d mediamtx

if ($LASTEXITCODE -ne 0) {
    Write-Error "Error: Docker Compose failed to start."
    exit 1
}

Write-Host "MediaMTX is running on:"
Write-Host "  - RTMP Ingest: rtmp://localhost:1935/dji"
Write-Host "  - WebRTC Play: http://localhost:8889/dji"

$response = Read-Host "Do you want to start the Backend and Frontend now? (y/n)"

if ($response -match "^[yY]") {
    Write-Host "Starting Backend and Frontend..."

    # Start Backend in a new window/tab or background job
    # For simplicity in PowerShell, we'll start new processes
    
    Write-Host "Starting Backend..."
    Start-Process -FilePath "python" -ArgumentList "master.py" -WorkingDirectory "CSRNet-pytorch"

    Write-Host "Starting Frontend..."
    Start-Process -FilePath "npm" -ArgumentList "start" -WorkingDirectory "frontend"

    Write-Host "Services started in separate windows."
} else {
    Write-Host "Done. You can run backend/frontend manually."
}
