import React, { useState, useRef, useEffect } from 'react';
import { Eye, Video, Maximize2, Settings, Activity, Users, AlertTriangle, MapPin } from 'lucide-react';

const CrowdLiveView = ({ globalStats, pins, setPins, onPinStatsUpdate, onPinAlert, highlightedPinId, heatmapGrid, isConnected, sendFrame, joinRoom, updatePlaybackTime }) => {
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [isPinMode, setIsPinMode] = useState(false);
  const [nextPinName, setNextPinName] = useState('');
  const [sourceMode, setSourceMode] = useState('upload'); // 'drone', 'webcam', 'upload'
  const videoRef = useRef(null);
  const fullscreenRef = useRef(null);
  const webcamRef = useRef(null);
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);
  const requestRef = useRef();
  const webcamIntervalRef = useRef(null);
  const pinRiskDurations = useRef({}); // Track how long a pin has been at risk
  const [isVideoUploaded, setIsVideoUploaded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [playbackUrl, setPlaybackUrl] = useState(null);
  const [websocketRoom, setWebsocketRoom] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  // Handle Source Change
  const handleSourceChange = async (mode) => {
    if (mode === sourceMode) return;

    console.log(`Switching from ${sourceMode} to ${mode}`);

    // STEP 1: Kill all existing processes first
    try {
      // Stop webcam if running
      stopWebcam();
      
      // Stop backend stream
      await fetch('http://localhost:5001/stop_stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }).catch(e => console.log('Stop stream:', e.message));
      
      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (e) {
      console.error('Error stopping previous source:', e);
    }

    // STEP 2: Update mode
    setSourceMode(mode);
    setIsVideoUploaded(false);

    // STEP 3: Start new source
    if (mode === 'webcam') {
      // Start webcam
      await startWebcam();
      
      // Notify backend
      try {
        await fetch('http://localhost:5001/set_source', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source: 'webcam' })
        });
      } catch (e) {
        console.error('Failed to set webcam source:', e);
      }
    } else if (mode === 'drone') {
      // Notify backend to start drone stream
      try {
        await fetch('http://localhost:5001/set_source', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source: 'drone' })
        });
      } catch (e) {
        console.error('Failed to set drone source:', e);
      }
    } else if (mode === 'upload') {
      // Upload mode - user will upload file
      // No backend call needed until file is uploaded
      fileInputRef.current.click();
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const formData = new FormData();
      formData.append('file', file);

      setIsUploading(true);
      setUploadProgress(0);

      try {
        const response = await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          
          xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable) {
              const percentComplete = (event.loaded / event.total) * 100;
              setUploadProgress(percentComplete);
            }
          });
          
          xhr.addEventListener('load', () => {
            console.log('[Upload] Response Status:', xhr.status);
            console.log('[Upload] Response Text:', xhr.responseText);
            
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const data = JSON.parse(xhr.responseText);
                console.log('[Upload] Parsed Data:', data);
                
                if (data.success) {
                    resolve(data);
                } else {
                    console.error('[Upload] Server returned success=false:', data.error);
                    reject(new Error(data.error || 'Upload failed'));
                }
              } catch (e) {
                console.error('[Upload] JSON Parse Error:', e);
                reject(new Error('Invalid response'));
              }
            } else {
              console.error('[Upload] HTTP Error:', xhr.statusText);
              reject(new Error('Upload failed'));
            }
          });
          
          xhr.addEventListener('error', (e) => {
            console.error('[Upload] Network Error:', e);
            reject(new Error('Upload failed'));
          });
          
          console.log('[Upload] Starting upload to http://localhost:5001/api/upload');
          xhr.open('POST', 'http://localhost:5001/api/upload');
          xhr.send(formData);
        });
        
        setSourceMode('upload');
        setPlaybackUrl(response.playbackUrl);
        setWebsocketRoom(response.websocketRoom);
        if (joinRoom && response.websocketRoom) {
            joinRoom(response.websocketRoom);
        }
        
        setIsVideoUploaded(true);
        stopWebcam();
        setUploadProgress(100);
        setTimeout(() => {
          setIsUploading(false);
          setUploadProgress(0);
        }, 1000);
      } catch (e) {
        console.error("Upload failed:", e);
        alert("Failed to upload video");
        setIsUploading(false);
        setUploadProgress(0);
      }
    }
  };

  const startWebcam = async () => {
    stopWebcam(); // Ensure clean start
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (webcamRef.current) {
        webcamRef.current.srcObject = stream;
      }
      
      // Start processing loop - increased to 10 FPS for better responsiveness
      webcamIntervalRef.current = setInterval(() => {
        captureAndSendFrame();
      }, 100); // 10 FPS for faster response
    } catch (e) {
      console.error("Webcam access denied:", e);
      alert("Could not access webcam");
      setSourceMode('drone'); // Fallback
    }
  };

  const stopWebcam = () => {
    if (webcamIntervalRef.current) clearInterval(webcamIntervalRef.current);
    if (webcamRef.current && webcamRef.current.srcObject) {
      webcamRef.current.srcObject.getTracks().forEach(track => track.stop());
    }
  };

  const captureAndSendFrame = () => {
    if (!webcamRef.current || !isConnected || !sendFrame) return;
    
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 360;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(webcamRef.current, 0, 0, canvas.width, canvas.height);
    
    const base64Image = canvas.toDataURL('image/jpeg', 0.7);
    
    sendFrame(base64Image);
  };

  // Cleanup
  useEffect(() => {
    return () => stopWebcam();
  }, []);

  // Jet Colormap Function
  const getJetColor = (v) => {
      // v is 0 to 1
      let r = Math.max(0, Math.min(1, 1.5 - Math.abs(4 * v - 3)));
      let g = Math.max(0, Math.min(1, 1.5 - Math.abs(4 * v - 2)));
      let b = Math.max(0, Math.min(1, 1.5 - Math.abs(4 * v - 1)));
      return `rgba(${Math.floor(r * 255)}, ${Math.floor(g * 255)}, ${Math.floor(b * 255)}, 0.9)`; // Fixed high alpha for vibrancy
  };

  // Ref for smoothing
  const displayedGridRef = useRef(null);
  const animationFrameId = useRef(null);

  // Draw Heatmap Loop
  useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      
      // Apply Pin Boosts to Heatmap Grid
      // This modifies the actual heatmap values, not just visuals
      let boostedHeatmapGrid = heatmapGrid;
      if (heatmapGrid && pins.length > 0) {
        boostedHeatmapGrid = [...heatmapGrid]; // Clone to avoid mutation
        const maxDensity = globalStats?.maxDensity || 0.001;
        
        pins.forEach(pin => {
          const cols = 60;
          const rows = 40;
          const pinCol = Math.floor((pin.x / 100) * cols);
          const pinRow = Math.floor((pin.y / 100) * rows);
          
          // Apply boost to surrounding cells
          for (let r = -3; r <= 3; r++) {
            for (let c = -3; c <= 3; c++) {
              const targetCol = pinCol + c;
              const targetRow = pinRow + r;
              
              if (targetCol >= 0 && targetCol < cols && targetRow >= 0 && targetRow < rows) {
                const idx = targetRow * cols + targetCol;
                const cellX = (targetCol / cols) * 100;
                const cellY = (targetRow / rows) * 100;
                const dx = cellX - pin.x;
                const dy = cellY - pin.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                const influenceRadius = 15; // percentage units
                if (dist < influenceRadius) {
                  // Boost factor: closer = more boost
                  const boostFactor = (influenceRadius - dist) / influenceRadius;
                  const boost = maxDensity * 0.5 * boostFactor; // Up to 50% of max
                  boostedHeatmapGrid[idx] = (boostedHeatmapGrid[idx] || 0) + boost;
                }
              }
            }
          }
        });
      }
      
      // Initialize displayed grid if needed
      if (boostedHeatmapGrid && !displayedGridRef.current) {
          displayedGridRef.current = [...boostedHeatmapGrid];
      }

      const render = () => {
          if (!boostedHeatmapGrid || !displayedGridRef.current) {
              animationFrameId.current = requestAnimationFrame(render);
              return;
          }

          // Set canvas size
          canvas.width = 600; 
          canvas.height = 400;
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          if (!showHeatmap) {
              animationFrameId.current = requestAnimationFrame(render);
              return;
          }

          // LERP Factor (Smoothing)
          // Adjust 0.1 for speed (lower = smoother/slower)
          const lerpFactor = 0.1; 

          // Auto-scale
          let maxDensity = globalStats?.maxDensity || 0.0001;
          if (maxDensity < 0.0001) maxDensity = 0.001;

          // Apply blur for smooth blobs and increased brightness for vibrancy
          ctx.filter = 'blur(15px) brightness(2.5)'; 
          
          const cols = 60;
          const rows = 40;
          const cellW = canvas.width / cols;
          const cellH = canvas.height / rows;

          for (let i = 0; i < boostedHeatmapGrid.length; i++) {
              // LERP current value towards target
              const targetVal = boostedHeatmapGrid[i];
              let currentVal = displayedGridRef.current[i];
              
              // Simple LERP
              currentVal = currentVal + (targetVal - currentVal) * lerpFactor;
              displayedGridRef.current[i] = currentVal;

              if (currentVal <= 0) continue;

              // Calculate coordinates
              const col = i % cols;
              const row = Math.floor(i / cols);

              // Normalize (no additional pin boost here - already in grid)
              const norm = Math.min(1, currentVal / maxDensity);
              if (norm < 0.1) continue; // Noise floor

              ctx.fillStyle = getJetColor(norm);
              // Draw overlapping rects for smoothness
              ctx.fillRect(col * cellW, row * cellH, cellW + 2, cellH + 2);
          }
          
          // Reset filter
          ctx.filter = 'none';
          
          animationFrameId.current = requestAnimationFrame(render);
      };

      animationFrameId.current = requestAnimationFrame(render);

      return () => {
          cancelAnimationFrame(animationFrameId.current);
      };
  }, [heatmapGrid, showHeatmap, globalStats, pins]);

  // Initialize Blobs - REMOVED for real data
  // useEffect(() => { ... }, []);

  // Animation Loop
  useEffect(() => {
    const animate = () => {
      // Update Blob Positions - REMOVED

      // Calculate Pin Stats based on heatmap density at pin location
      if (onPinStatsUpdate) {
        if (pins.length === 0) {
          onPinStatsUpdate([]);
        } else {
          const newStats = pins.map(pin => {
            let density = 0;
            
            // Sample from heatmapGrid if available
            if (heatmapGrid && heatmapGrid.length === 2400) {
                // Map pin x,y (0-100) to grid coordinates (60x40)
                const col = Math.floor((pin.x / 100) * 60);
                const row = Math.floor((pin.y / 100) * 40);
                const idx = Math.min(2399, Math.max(0, row * 60 + col));
                density = heatmapGrid[idx] || 0;
                
                // Apply Pin Density Boost (same as visualization)
                // Sum up nearby cell densities to simulate increased sensitivity
                const maxDensity = globalStats?.maxDensity || 0.001;
                const influenceRadius = 15; // percentage units
                let boostSum = 0;
                let boostCount = 0;
                
                // Sample grid cells within influence radius
                for (let r = -2; r <= 2; r++) {
                  for (let c = -2; c <= 2; c++) {
                    const sampleCol = Math.max(0, Math.min(59, col + c));
                    const sampleRow = Math.max(0, Math.min(39, row + r));
                    const sampleIdx = sampleRow * 60 + sampleCol;
                    
                    const cellX = (sampleCol / 60) * 100;
                    const cellY = (sampleRow / 40) * 100;
                    const dx = cellX - pin.x;
                    const dy = cellY - pin.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    
                    if (dist < influenceRadius) {
                      const weight = (influenceRadius - dist) / influenceRadius;
                      boostSum += (heatmapGrid[sampleIdx] || 0) * weight;
                      boostCount += weight;
                    }
                  }
                }
                
                // Apply boost - pins make density more sensitive
                if (boostCount > 0) {
                  const averageBoosted = boostSum / boostCount;
                  density = Math.max(density, averageBoosted);
                }
            }

            // Normalize using global max density for consistent risk assessment
            const maxDensity = globalStats?.maxDensity || 0.001;
            const normalizedDensity = Math.min(1, density / maxDensity);
            
            // Determine Risk based on normalized density
            let riskLevel = 'low';
            if (normalizedDensity > 0.8) riskLevel = 'critical';
            else if (normalizedDensity > 0.6) riskLevel = 'high';
            else if (normalizedDensity > 0.3) riskLevel = 'medium';

            // Alert Logic: Track duration of high/critical risk
            if (riskLevel === 'high' || riskLevel === 'critical') {
              if (!pinRiskDurations.current[pin.id]) {
                pinRiskDurations.current[pin.id] = { startTime: Date.now(), notified: false };
              } else {
                const duration = Date.now() - pinRiskDurations.current[pin.id].startTime;
                if (duration > 3000 && !pinRiskDurations.current[pin.id].notified) {
                  // Capture Snapshot
                  let snapshot = null;
                  try {
                      // We can try to capture from the video element (img tag)
                      // Since it's an MJPEG stream in an img tag, we can draw it to a canvas
                      // Note: This requires the image to be loaded and cross-origin clean (localhost usually fine)
                      const videoEl = document.querySelector('#live-video-feed'); // We'll add this ID
                      if (videoEl) {
                          const canvas = document.createElement('canvas');
                          const ctx = canvas.getContext('2d');
                          
                          // Set canvas size to match video natural size or displayed size
                          // Use displayed size for simplicity of cropping
                          const rect = videoEl.getBoundingClientRect();
                          canvas.width = rect.width;
                          canvas.height = rect.height;
                          
                          // Draw image
                          ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
                          
                          // Crop around pin
                          // Pin x,y are percentages
                          const pinX = (pin.x / 100) * canvas.width;
                          const pinY = (pin.y / 100) * canvas.height;
                          
                          // Crop size (e.g., 150x100 around pin)
                          const cropW = 200;
                          const cropH = 150;
                          const cropX = Math.max(0, pinX - cropW/2);
                          const cropY = Math.max(0, pinY - cropH/2);
                          
                          // Create final snapshot canvas
                          const cropCanvas = document.createElement('canvas');
                          cropCanvas.width = cropW;
                          cropCanvas.height = cropH;
                          const cropCtx = cropCanvas.getContext('2d');
                          
                          cropCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
                          
                          // Overlay Heatmap? Optional, but nice.
                          // For now just video is fine as requested "area around where the pin was"
                          
                          snapshot = cropCanvas.toDataURL('image/jpeg', 0.8);
                      }
                  } catch (e) {
                      console.error("Snapshot failed", e);
                  }

                  // Trigger Alert
                  if (onPinAlert) {
                    onPinAlert({
                      id: `${Date.now()}-${pin.id}`,
                      timestamp: Date.now(),
                      zoneId: pin.id,
                      zoneName: pin.name,
                      severity: riskLevel,
                      message: `Sustained ${riskLevel.toUpperCase()} density detected in ${pin.name}.`,
                      snapshot: snapshot,
                      snapshotColor: riskLevel === 'critical' ? '#ef4444' : '#f59e0b',
                      onResolve: () => {
                        // Reset notification flag when alert is resolved
                        if (pinRiskDurations.current[pin.id]) {
                          pinRiskDurations.current[pin.id].notified = false;
                          delete pinRiskDurations.current[pin.id];
                        }
                      }
                    });
                  }
                  pinRiskDurations.current[pin.id].notified = true; // Prevent spam
                }
              }
            } else {
              // Reset if risk drops below high
              if (pinRiskDurations.current[pin.id]) {
                delete pinRiskDurations.current[pin.id];
              }
            }

            // Periodic Checkup System - Info alerts with screenshots every 60 seconds
            if (!pinRiskDurations.current[`${pin.id}_checkup`]) {
              pinRiskDurations.current[`${pin.id}_checkup`] = { lastCheckup: Date.now() };
            } else {
              const timeSinceLastCheckup = Date.now() - pinRiskDurations.current[`${pin.id}_checkup`].lastCheckup;
              if (timeSinceLastCheckup > 60000) { // 60 seconds
                // Capture snapshot for checkup
                let snapshot = null;
                try {
                  const videoEl = document.querySelector('#live-video-feed');
                  if (videoEl) {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    const rect = videoEl.getBoundingClientRect();
                    canvas.width = rect.width;
                    canvas.height = rect.height;
                    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
                    
                    const pinX = (pin.x / 100) * canvas.width;
                    const pinY = (pin.y / 100) * canvas.height;
                    const cropW = 200;
                    const cropH = 150;
                    const cropX = Math.max(0, pinX - cropW/2);
                    const cropY = Math.max(0, pinY - cropH/2);
                    
                    const cropCanvas = document.createElement('canvas');
                    cropCanvas.width = cropW;
                    cropCanvas.height = cropH;
                    const cropCtx = cropCanvas.getContext('2d');
                    cropCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
                    snapshot = cropCanvas.toDataURL('image/jpeg', 0.8);
                  }
                } catch (error) {
                  console.error('Failed to capture checkup snapshot:', error);
                }
                
                // Trigger periodic checkup alert
                if (onPinAlert) {
                  onPinAlert({
                    id: `${Date.now()}-checkup-${pin.id}`,
                    timestamp: Date.now(),
                    zoneId: pin.id,
                    zoneName: pin.name,
                    severity: 'low', // Checkups are informational
                    message: `Routine checkup for ${pin.name}: ${Math.round(normalizedDensity * 100)}% density, ${riskLevel} risk.`,
                    snapshot: snapshot,
                    snapshotColor: '#3b82f6', // Blue for info
                    onResolve: () => {}
                  });
                }
                
                // Update last checkup time
                pinRiskDurations.current[`${pin.id}_checkup`].lastCheckup = Date.now();
              }
            }

            return {
              id: pin.id,
              name: pin.name,
              peopleCount: Math.round(density * 100), // Rough estimate
              density: normalizedDensity,
              riskLevel: riskLevel
            };
          });
          onPinStatsUpdate(newStats);
        }
      }

      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [pins, onPinStatsUpdate, onPinAlert, heatmapGrid, globalStats]);

  // if (!globalStats) return <div className="panel" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Initializing Feed...</div>;

  const { totalPeople, globalDensity, globalRiskLevel } = globalStats || { 
    totalPeople: 0, 
    globalDensity: 0, 
    globalRiskLevel: 'low',
    maxDensity: 0.001
  };

  const getRiskColor = (level) => {
    switch (level) {
      case 'critical': return 'var(--danger)';
      case 'high': return 'var(--warning)';
      case 'medium': return '#f59e0b'; // Orange-ish
      default: return 'var(--success)';
    }
  };

  const handleVideoClick = (e) => {
    if (!isPinMode || !videoRef.current) return;

    // Use pre-set name or default
    const name = nextPinName.trim() || `ZONE ${String(pins.length + 1).padStart(2, '0')}`;

    const rect = videoRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100; // Percentage
    const y = ((e.clientY - rect.top) / rect.height) * 100; // Percentage

    setPins([...pins, { x, y, id: Date.now(), name }]);
    setIsPinMode(false); // Exit pin mode after dropping
    setNextPinName(''); // Reset input
  };

  const removePin = (id, e) => {
    e.stopPropagation();
    setPins(pins.filter(p => p.id !== id));
  };

  const onDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (sourceMode === 'upload') {
      setIsDragging(true);
    }
  };

  const onDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const onDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('video/')) {
        const formData = new FormData();
        formData.append('file', file);

        setIsUploading(true);
        setUploadProgress(0);

        try {
          const response = await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            
            xhr.upload.addEventListener('progress', (event) => {
              if (event.lengthComputable) {
                const percentComplete = (event.loaded / event.total) * 100;
                setUploadProgress(percentComplete);
              }
            });
            
            xhr.addEventListener('load', () => {
              console.log('[DropUpload] Response Status:', xhr.status);
              console.log('[DropUpload] Response Text:', xhr.responseText);

              if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const data = JSON.parse(xhr.responseText);
                    console.log('[DropUpload] Parsed Data:', data);

                    if (data.success) {
                        resolve(data);
                    } else {
                        console.error('[DropUpload] Server returned success=false:', data.error);
                        reject(new Error(data.error || 'Upload failed'));
                    }
                } catch (e) {
                    console.error('[DropUpload] JSON Parse Error:', e);
                    reject(new Error('Invalid response'));
                }
              } else {
                console.error('[DropUpload] HTTP Error:', xhr.statusText);
                reject(new Error('Upload failed'));
              }
            });
            
            xhr.addEventListener('error', (e) => {
                console.error('[DropUpload] Network Error:', e);
                reject(new Error('Upload failed'));
            });
            
            console.log('[DropUpload] Starting upload to http://localhost:5001/api/upload');
            xhr.open('POST', 'http://localhost:5001/api/upload');
            xhr.send(formData);
          });
          
          setSourceMode('upload');
          setPlaybackUrl(response.playbackUrl);
          setWebsocketRoom(response.websocketRoom);
          if (joinRoom && response.websocketRoom) {
            joinRoom(response.websocketRoom);
          }

          setIsVideoUploaded(true);
          setUploadProgress(100);
          setTimeout(() => {
            setIsUploading(false);
            setUploadProgress(0);
          }, 1000);
        } catch (e) {
            console.error("Upload failed:", e);
            alert("Failed to upload video");
            setIsUploading(false);
            setUploadProgress(0);
        }
    } else {
      alert('Please upload a valid video file');
    }
  };

  const handleDropzoneClick = () => {
    if (sourceMode === 'upload' && !isVideoUploaded) {
      fileInputRef.current.click();
    }
  };

  const handleStopStream = async () => {
    // Stop webcam if running
    stopWebcam();
    
    // Reset upload state
    setIsVideoUploaded(false);
    
    // Notify backend to stop stream
    try {
      await fetch('http://localhost:5001/stop_stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (e) {
      console.error("Failed to stop stream:", e);
    }
  };

  const handleStartStream = () => {
      // Default to drone or webcam if not set?
     // For now, let's just trigger the current source mode's start logic if applicable
     // But simpler: just use handleSourceChange(sourceMode) to restart?
     // Or specifically start webcam/drone
     if (sourceMode === 'webcam') startWebcam();
     else if (sourceMode === 'drone') handleSourceChange('drone');
     else if (sourceMode === 'upload') fileInputRef.current.click();
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
        if (fullscreenRef.current) {
            fullscreenRef.current.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
            });
        }
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
  };

  return (
    <div ref={fullscreenRef} className="panel" style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
      {/* Toolbar */}
      <div style={{ 
        padding: '0.5rem', 
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: 'var(--bg-tertiary)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingRight: '0.75rem', borderRight: '1px solid var(--border-color)' }}>
            <Video size={16} />
            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{sourceMode.toUpperCase()} FEED</span>
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              accept="video/*" 
              onChange={handleFileUpload}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <div style={{ 
                width: 6, 
                height: 6, 
                borderRadius: '50%', 
                backgroundColor: sourceMode === 'upload' ? 'var(--text-disabled)' : 'var(--success)', 
                animation: sourceMode === 'upload' ? 'none' : 'pulse 2s infinite',
                filter: sourceMode === 'upload' ? 'grayscale(100%) opacity(0.5)' : 'none'
            }}></div>
            <span style={{ 
                fontSize: '0.7rem', 
                fontWeight: 700, 
                color: sourceMode === 'upload' ? 'var(--text-disabled)' : 'var(--success)',
                filter: sourceMode === 'upload' ? 'opacity(0.5)' : 'none'
            }}>LIVE</span>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {/* Pre-name Input */}
          <input 
            type="text" 
            placeholder="Next Pin Name..." 
            value={nextPinName}
            onChange={(e) => setNextPinName(e.target.value)}
            style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              padding: '0.25rem 0.5rem',
              borderRadius: '2px',
              fontSize: '0.75rem',
              width: '120px',
              outline: 'none'
            }}
          />

          <button 
            className={`btn ${isPinMode ? 'btn-primary' : ''}`}
            onClick={() => setIsPinMode(!isPinMode)}
            title="Drop Priority Pin"
            style={{ cursor: isPinMode ? 'crosshair' : 'pointer' }}
          >
            <MapPin size={14} /> {isPinMode ? 'CLICK TO DROP' : 'DROP PIN'}
          </button>
          <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)', margin: '0 0.25rem' }}></div>
          <button 
            className={`btn ${showHeatmap ? 'btn-primary' : ''}`}
            onClick={() => setShowHeatmap(!showHeatmap)}
            title="Toggle Heatmap"
          >
            <Eye size={14} /> {showHeatmap ? 'HEATMAP ON' : 'HEATMAP OFF'}
          </button>
          <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)', margin: '0 0.25rem' }}></div>
          {/* Stream Toggle Logic: 
              Webcam: check if stream active 
              Upload: check if video uploaded
              Drone: check if connected (proxy for stream active)
          */}
          {(sourceMode === 'webcam' && webcamRef.current?.srcObject) || 
           (sourceMode === 'upload' && isVideoUploaded) ||
           (sourceMode === 'drone' && isConnected) ? (
            <button 
                className="btn"
                onClick={handleStopStream}
                title="Stop Stream"
                style={{ backgroundColor: 'var(--danger)', color: 'white' }}
            >
                STOP STREAM
            </button>
          ) : (
            <button 
                className="btn"
                onClick={handleStartStream}
                title="Start Stream"
                style={{ backgroundColor: 'var(--success)', color: 'white' }}
            >
                START STREAM
            </button>
          )}
          <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)', margin: '0 0.25rem' }}></div>
          <button className="btn" title="Settings" onClick={() => setShowSettings(true)}><Settings size={14} /></button>
          <button className="btn" title="Fullscreen" onClick={toggleFullscreen}><Maximize2 size={14} /></button>
        </div>
      </div>

      {/* Video Area */}
      <div 
        ref={videoRef}
        onClick={handleVideoClick}
        style={{ 
          flex: 1, 
          background: '#171717', 
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: isPinMode ? 'crosshair' : 'default'
        }}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {/* Video Container with fixed aspect ratio to ensure alignment */}
        <div style={{ 
            position: 'relative', 
            width: '100%', 
            height: '100%', 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center' 
        }}>
            {/* Inner container that maintains 16:9 aspect ratio */}
            <div style={{ 
                position: 'relative', 
                width: '100%', 
                aspectRatio: '16/9', 
                maxHeight: '100%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
            }}>
                {/* Upload Progress Bar */}
                {isUploading && (
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '4px',
                        backgroundColor: 'rgba(0,0,0,0.3)',
                        zIndex: 10
                    }}>
                        <div style={{
                            height: '100%',
                            width: `${uploadProgress}%`,
                            background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
                            transition: 'width 0.3s ease',
                            boxShadow: '0 0 10px rgba(102, 126, 234, 0.5)'
                        }} />
                    </div>
                )}
                
                {/* Real Video Stream */}
                {sourceMode === 'webcam' ? (
                    <video 
                        ref={webcamRef}
                        autoPlay 
                        playsInline 
                        muted
                        style={{ 
                            width: '100%', 
                            height: '100%', 
                            objectFit: 'contain'
                        }} 
                    />
                ) : sourceMode === 'upload' && !isVideoUploaded ? (
                    /* Dropzone for Upload Mode */
                    <div 
                        onClick={handleDropzoneClick}
                        style={{
                            width: '100%',
                            height: '100%',
                            background: isDragging 
                                ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                                : 'linear-gradient(to bottom right, #1a1a1a, #2d2d2d)',
                            border: isDragging 
                                ? '3px dashed #fff'
                                : '3px dashed rgba(255,255,255,0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'rgba(255,255,255,0.9)',
                            flexDirection: 'column',
                            gap: '1.5rem',
                            cursor: 'pointer',
                            transition: 'all 0.3s ease',
                            padding: '2rem'
                        }}
                    >
                        <Video size={80} strokeWidth={1.5} />
                        <div style={{ textAlign: 'center' }}>
                            <p style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                                {isDragging ? 'Drop video file here' : 'Upload Video'}
                            </p>
                            <p style={{ fontSize: '0.9rem', opacity: 0.7 }}>
                                Drag & drop or click to browse
                            </p>
                            <p style={{ fontSize: '0.75rem', opacity: 0.5, marginTop: '0.5rem' }}>
                                Supported: MP4, AVI, MOV, MKV
                            </p>
                        </div>
                    </div>
                ) : isConnected && sourceMode !== 'upload' ? (
                    <img 
                        id="live-video-feed"
                        src="http://localhost:5001/video_feed" 
                        alt="Live Stream" 
                        crossOrigin="anonymous"
                        style={{ 
                            width: '100%', 
                            height: '100%', 
                            objectFit: 'contain' 
                        }} 
                    />
                ) : sourceMode === 'upload' && isVideoUploaded && playbackUrl ? (
                    <video
                        id="live-video-feed"
                        crossOrigin="anonymous"
                        controls
                        autoPlay
                        src={playbackUrl}
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain'
                        }}
                        onTimeUpdate={(e) => {
                            if (updatePlaybackTime) {
                                updatePlaybackTime(e.target.currentTime * 1000);
                            }
                        }}
                    />
                ) : (
                    <div style={{
                        width: '100%',
                        height: '100%',
                        background: 'linear-gradient(to bottom right, #262626, #404040)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'rgba(255,255,255,0.5)',
                        flexDirection: 'column',
                        gap: '1rem'
                    }}>
                        <Activity size={64} strokeWidth={1} />
                        <p>Connecting to Drone...</p>
                    </div>
                )}

                {/* High-Res Canvas Heatmap Overlay */}
                <canvas 
                    ref={canvasRef}
                    style={{
                        position: 'absolute',
                        top: 0, left: 0, 
                        width: '100%', height: '100%',
                        opacity: showHeatmap ? 1.0 : 0, // Adjustable opacity
                        pointerEvents: 'none',
                        transition: 'opacity 0.3s ease',
                        mixBlendMode: 'screen' // Blends nicely with video
                    }}
                />
            </div>
        </div>

        {/* Pins Overlay */}
        {pins.map(pin => (
          <div
            key={pin.id}
            style={{
              position: 'absolute',
              left: `${pin.x}%`,
              top: `${pin.y}%`,
              transform: 'translate(-50%, -100%)',
              color: highlightedPinId === pin.id ? 'white' : 'var(--danger)',
              cursor: 'pointer',
              zIndex: 10,
              transition: 'all 0.3s ease',
              transformOrigin: 'bottom center',
              scale: highlightedPinId === pin.id ? '1.3' : '1'
            }}
            onClick={(e) => removePin(pin.id, e)}
            title="Priority Zone - Click to Remove"
          >
            <MapPin size={24} fill="currentColor" />
            <div style={{ 
              position: 'absolute', 
              top: '100%', 
              left: '50%', 
              transform: 'translateX(-50%)', 
              backgroundColor: 'var(--bg-secondary)', 
              padding: '2px 4px', 
              borderRadius: '2px', 
              fontSize: '0.6rem', 
              whiteSpace: 'nowrap',
              border: '1px solid var(--border-color)',
              fontWeight: 700,
              color: 'var(--text-primary)'
            }}>
              {pin.name}
            </div>
          </div>
        ))}

        {/* HUD Overlay - Top Left - REMOVED CAM_ID */}

        {/* Source Dropdown - Top Right Overlay */}
        <div style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            zIndex: 50
        }}>
            <select 
              value={sourceMode} 
              onChange={(e) => handleSourceChange(e.target.value)}
              style={{
                background: 'rgba(0, 0, 0, 0.7)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: 'white',
                fontWeight: 600,
                fontSize: '0.8rem',
                padding: '0.5rem',
                borderRadius: '4px',
                outline: 'none',
                cursor: 'pointer',
                backdropFilter: 'blur(4px)'
              }}
            >
              <option value="drone">DRONE FEED</option>
              <option value="webcam">WEBCAM</option>
              <option value="upload">UPLOAD VIDEO</option>
            </select>
        </div>

        {/* Global Metrics Badges - Top Right */}
        <div style={{
          position: 'absolute',
          top: '3.5rem', // Moved down to make room for dropdown
          right: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          alignItems: 'flex-end',
          pointerEvents: 'none'
        }}>
          <div className="panel" style={{ padding: '0.25rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'rgba(0,0,0,0.7)', color: 'white', border: '1px solid rgba(255,255,255,0.2)' }}>
            <Users size={14} />
            <span style={{ fontWeight: 700 }}>{totalPeople}</span>
            <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>DETECTED</span>
          </div>
          <div className="panel" style={{ padding: '0.25rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'rgba(0,0,0,0.7)', color: 'white', border: '1px solid rgba(255,255,255,0.2)' }}>
            <Activity size={14} />
            <span style={{ fontWeight: 700 }}>{(globalDensity * 100).toFixed(0)}%</span>
            <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>DENSITY</span>
          </div>
          <div className="panel" style={{ 
            padding: '0.25rem 0.5rem', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.5rem', 
            backgroundColor: getRiskColor(globalRiskLevel), 
            color: 'white', 
            border: 'none' 
          }}>
            <AlertTriangle size={14} />
            <span style={{ fontWeight: 700, textTransform: 'uppercase' }}>{globalRiskLevel} RISK</span>
          </div>
        </div>

        {/* Crosshair */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '40px',
          height: '40px',
          border: '1px solid rgba(255,255,255,0.3)',
          borderRadius: '50%',
          pointerEvents: 'none'
        }}>
          <div style={{ position: 'absolute', top: '50%', left: '50%', width: '4px', height: '4px', background: 'rgba(255,255,255,0.5)', transform: 'translate(-50%, -50%)', borderRadius: '50%' }}></div>
        </div>
      </div>
      
      {/* Settings Modal */}
      {showSettings && (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
        }} onClick={() => setShowSettings(false)}>
            <div style={{
                backgroundColor: 'var(--bg-secondary)',
                padding: '2rem',
                borderRadius: '8px',
                width: '400px',
                border: '1px solid var(--border-color)',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
            }} onClick={e => e.stopPropagation()}>
                <h3 style={{ marginTop: 0, color: 'var(--text-primary)' }}>Settings</h3>
                <div style={{ height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                    Settings placeholder...
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                    <button className="btn" onClick={() => setShowSettings(false)}>Close</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default CrowdLiveView;
