import React, { useState, useRef, useEffect } from 'react';
import { Activity, Users, AlertTriangle, MapPin, ExternalLink } from 'lucide-react';
// import '@livekit/components-styles';  <-- REMOVED
// import { Room, RoomEvent, VideoPresets, ConnectionState } from 'livekit-client'; <-- REMOVED

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
  
  // STREAMING STATE
  const [streamInfo, setStreamInfo] = useState(null);
  
  // Fetch stream info on mount
  useEffect(() => {
    const protocol = window.location.protocol;
    const host = window.location.hostname;
    fetch(`${protocol}//${host}:8000/api/stream/info`)
      .then(res => res.json())
      .then(data => setStreamInfo(data))
      .catch(err => console.error("Failed to fetch stream info", err));
  }, []);

  const addLog = (msg) => {
    console.log(`[CSRNet Debug] ${msg}`);
  };

  
  // --- EXISTING LOGIC ---

  // Handle Source Change
  const handleSourceChange = async (mode) => {
    if (mode === sourceMode) return;
    addLog(`Switching Source: ${sourceMode} -> ${mode}`);

    // Cleanup first
    try {
      stopWebcam();
      // Stop backend stream if needed
      const protocol = window.location.protocol;
      const host = window.location.hostname;
      await fetch(`${protocol}//${host}:8000/stop_stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }).catch(e => console.log('Stop stream error (safe to ignore):', e.message));
      
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (e) { console.error(e); }

    // Update Mode
    setSourceMode(mode);
    setIsVideoUploaded(false);

    if (mode === 'webcam') {
      await startWebcam();
      const protocol = window.location.protocol;
      const host = window.location.hostname;
      fetch(`${protocol}//${host}:8000/set_source`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source: 'webcam' })
      }).catch(e => {});

    } else if (mode === 'drone') {
        // Nothing special to init, just switch view
        console.log("Switched to drone mode");
    } else if (mode === 'upload') {
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
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const data = JSON.parse(xhr.responseText);
                if (data.success) resolve(data);
                else reject(new Error(data.error || 'Upload failed'));
              } catch (e) { reject(new Error('Invalid response')); }
            } else { reject(new Error('Upload failed')); }
          });
          xhr.addEventListener('error', (e) => reject(new Error('Upload failed')));
          
          const protocol = window.location.protocol;
          const host = window.location.hostname;
          xhr.open('POST', `${protocol}//${host}:8000/api/upload`);
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
      
      webcamIntervalRef.current = setInterval(() => {
        captureAndSendFrame();
      }, 100); 
    } catch (e) {
      console.error("Webcam error:", e);
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
        // ... (reuse handleFileUpload logic for drop)
        const formData = new FormData();
        formData.append('file', file);
        setIsUploading(true);
        setUploadProgress(0);
        // Simplified generic fetch for brevity
        try {
             const protocol = window.location.protocol;
             const host = window.location.hostname;
             const res = await fetch(`${protocol}//${host}:8000/api/upload`, { method: 'POST', body: formData });
             const data = await res.json();
             if (data.success) {
                setSourceMode('upload');
                setPlaybackUrl(data.playbackUrl);
                setWebsocketRoom(data.websocketRoom);
                if (joinRoom && data.websocketRoom) joinRoom(data.websocketRoom);
                setIsVideoUploaded(true);
                stopWebcam();
             }
        } catch(e) { console.error(e); }
        setIsUploading(false);
    }
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
      return `rgba(${Math.floor(r * 255)}, ${Math.floor(g * 255)}, ${Math.floor(b * 255)}, 0.9)`;
  };

  // HEATMAP RENDERING
  const displayedGridRef = useRef(null);
  const animationFrameId = useRef(null);

  useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      
      let boostedHeatmapGrid = heatmapGrid;
      if (heatmapGrid && pins.length > 0) {
        boostedHeatmapGrid = [...heatmapGrid]; 
        const maxDensity = globalStats?.maxDensity || 0.001;
        
        pins.forEach(pin => {
          const cols = 60;
          const rows = 40;
          const pinCol = Math.floor((pin.x / 100) * cols);
          const pinRow = Math.floor((pin.y / 100) * rows);
          for (let r = -3; r <= 3; r++) {
            for (let c = -3; c <= 3; c++) {
              const targetCol = pinCol + c;
              const targetRow = pinRow + r;
              if (targetCol >= 0 && targetCol < cols && targetRow >= 0 && targetRow < rows) {
                const idx = targetRow * cols + targetCol;
                // ... simplified boost logic ...
                 const idx2 = idx; // (Avoiding long lines)
                 boostedHeatmapGrid[idx2] = (boostedHeatmapGrid[idx2] || 0) + (maxDensity * 0.2);
              }
            }
          }
        });
      }
      
      if (boostedHeatmapGrid && !displayedGridRef.current) {
          displayedGridRef.current = [...boostedHeatmapGrid];
      }

      const render = () => {
          if (!boostedHeatmapGrid || !displayedGridRef.current) {
              animationFrameId.current = requestAnimationFrame(render);
              return;
          }

          canvas.width = 600; 
          canvas.height = 400;
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          if (!showHeatmap) {
              animationFrameId.current = requestAnimationFrame(render);
              return;
          }

          const lerpFactor = 0.1; 
          let maxDensity = globalStats?.maxDensity || 0.0001;
          if (maxDensity < 0.0001) maxDensity = 0.001;

          ctx.filter = 'blur(15px) brightness(2.5)'; 
          
          const cols = 60;
          const rows = 40;
          const cellW = canvas.width / cols;
          const cellH = canvas.height / rows;

          for (let i = 0; i < boostedHeatmapGrid.length; i++) {
              const targetVal = boostedHeatmapGrid[i];
              let currentVal = displayedGridRef.current[i];
              currentVal = currentVal + (targetVal - currentVal) * lerpFactor;
              displayedGridRef.current[i] = currentVal;
              if (currentVal <= 0) continue;

              const col = i % cols;
              const row = Math.floor(i / cols);
              const norm = Math.min(1, currentVal / maxDensity);
              if (norm < 0.1) continue; 
              ctx.fillStyle = getJetColor(norm);
              ctx.fillRect(col * cellW, row * cellH, cellW + 2, cellH + 2);
          }
          ctx.filter = 'none';
          animationFrameId.current = requestAnimationFrame(render);
      };
      animationFrameId.current = requestAnimationFrame(render);
      return () => cancelAnimationFrame(animationFrameId.current);
  }, [heatmapGrid, showHeatmap, globalStats, pins]);

  useEffect(() => {
    const animate = () => {
      // Pin Logic 
      if (onPinStatsUpdate) {
        if (pins.length === 0) {
          onPinStatsUpdate([]);
        } else {
           const newStats = pins.map(pin => {
             return { id: pin.id, name: pin.name, peopleCount: 0, density: 0, riskLevel: 'low' };
           });
           onPinStatsUpdate(newStats); 
        }
      }
      requestRef.current = requestAnimationFrame(animate);
    };
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [pins, onPinStatsUpdate]); 

  const { totalPeople, globalDensity, globalRiskLevel } = globalStats || { 
    totalPeople: 0, globalDensity: 0, globalRiskLevel: 'low'
  };

  const getRiskColor = (level) => {
    switch (level) {
      case 'critical': return 'var(--danger)';
      case 'high': return 'var(--warning)';
      case 'medium': return '#f59e0b';
      default: return 'var(--success)';
    }
  };

  const handleVideoClick = (e) => {
    if (!isPinMode || !videoRef.current) return;
    const name = nextPinName.trim() || `ZONE ${String(pins.length + 1).padStart(2, '0')}`;
    const rect = videoRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100; // Percentage
    const y = ((e.clientY - rect.top) / rect.height) * 100; // Percentage
    setPins([...pins, { x, y, id: Date.now(), name }]);
    setIsPinMode(false); 
    setNextPinName(''); 
  };

  return (
    <div style={{
      flex: 1, position: 'relative', overflow: 'hidden',
      backgroundColor: 'black'
    }} ref={fullscreenRef}>
      
      {/* --- Main Content Area --- */}
      <div 
        style={{ position: 'relative', width: '100%', height: '100%' }}
        onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
        onClick={handleVideoClick}
      >
        {/* Upload Overlay */}
        {isDragging && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 100,
            backgroundColor: 'rgba(37, 99, 235, 0.8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: '1.5rem', fontWeight: 'bold'
          }}>
            Drop Video Here
          </div>
        )}
        
        {/* WEBCAM RENDERER */}
        <video 
            ref={webcamRef} autoPlay playsInline muted 
            style={{ 
                width: '100%', height: '100%', objectFit: 'contain', 
                display: sourceMode === 'webcam' ? 'block' : 'none' 
            }}
        />

        {/* DRONE / MEDIAMTX RENDERER */}
        <div style={{ 
            width: '100%', height: '100%', 
            display: sourceMode === 'drone' ? 'block' : 'none',
            position: 'relative'
        }}>
           {streamInfo ? (
               <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
                   {/* Player */}
                   <iframe 
                        src={streamInfo.webrtc_play_url} 
                        style={{ flex: 1, border: 'none', background: 'black' }}
                        allow="autoplay; fullscreen"
                        title="Drone Steam"
                   />
                   
                   {/* Stream Info Overlay Controls */}
                   <div style={{
                       position: 'absolute', top: '1rem', left: '1rem',
                       background: 'rgba(0,0,0,0.8)', padding: '1rem', borderRadius: '8px',
                       color: 'white', maxWidth: '400px', fontSize: '0.85rem'
                   }}>
                       <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                           <div style={{ width: 8, height: 8, background: '#10b981', borderRadius: '50%' }}></div>
                           Local Drone Stream
                       </div>
                       
                       <div style={{ marginBottom: '0.5rem' }}>
                           <label style={{ color: '#9ca3af', display: 'block', marginBottom: '2px' }}>RTMP Ingest (For Drone)</label>
                           <div style={{ display: 'flex', gap: '0.5rem' }}>
                               <code style={{ background: '#374151', padding: '2px 6px', borderRadius: '4px', flex: 1, fontSize: '0.75rem' }}>
                                   {streamInfo.rtmp_ingest_url}
                               </code>
                                <button onClick={() => { 
                                   if (navigator.clipboard && window.isSecureContext) {
                                       navigator.clipboard.writeText(streamInfo.rtmp_ingest_url); 
                                       alert("Copied!"); 
                                   } else {
                                       alert("Copy not supported over HTTP. Please copy manually.");
                                   }
                                }}
                                   style={{ background: '#2563eb', border: 'none', color: 'white', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer' }}>
                                   Copy
                               </button>
                           </div>
                       </div>
                       
                       <p style={{ margin: 0, opacity: 0.7, fontSize: '0.75rem' }}>
                           {streamInfo.notes}
                       </p>
                   </div>
               </div>
           ) : (
               <div style={{
                   width: '100%', height: '100%',
                   display: 'flex', alignItems: 'center', justifyContent: 'center',
                   color: 'white'
               }}>
                   <Activity className="animate-spin" size={32} />
                   <p style={{ marginLeft: '1rem' }}>Loading Stream Info...</p>
               </div>
           )}
        </div>

        {/* UPLOAD RENDERER */}
        {sourceMode === 'upload' && isVideoUploaded && playbackUrl ? (
            <video
                ref={videoRef}
                crossOrigin="anonymous" controls autoPlay src={playbackUrl}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                onTimeUpdate={(e) => updatePlaybackTime && updatePlaybackTime(e.target.currentTime * 1000)}
            />
        ) : sourceMode === 'upload' && !isVideoUploaded && (
            <div style={{
                width: '100%', height: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'rgba(255,255,255,0.5)', flexDirection: 'column', gap: '1rem'
            }}>
                <Activity size={64} strokeWidth={1} />
                <p>Upload a video or Drag & Drop</p>
            </div>
        )}

        {/* Overlays */}
        <canvas ref={canvasRef} style={{
                position: 'absolute', inset: 0, width: '100%', height: '100%',
                opacity: showHeatmap ? 1.0 : 0, pointerEvents: 'none', mixBlendMode: 'screen'
        }} />

        {/* Pins */}
        {pins.map(pin => (
          <div key={pin.id} onClick={(e) => removePin(pin.id, e)} title="Click to Remove"
            style={{
              position: 'absolute', left: `${pin.x}%`, top: `${pin.y}%`,
              transform: 'translate(-50%, -100%)', color: highlightedPinId === pin.id ? 'white' : 'var(--danger)',
              cursor: 'pointer', zIndex: 10, scale: highlightedPinId === pin.id ? '1.3' : '1'
            }}
          >
            <MapPin size={24} fill="currentColor" />
            <div style={{ 
              position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', 
              backgroundColor: 'var(--bg-secondary)', padding: '2px 4px', fontSize: '0.6rem', 
              whiteSpace: 'nowrap', border: '1px solid var(--border-color)'
            }}>{pin.name}</div>
          </div>
        ))}

        {/* Controls Overlay */}
        <div style={{ position: 'absolute', top: '1rem', right: '1rem', zIndex: 50 }}>
            <select value={sourceMode} onChange={(e) => handleSourceChange(e.target.value)}
              style={{
                background: 'rgba(0, 0, 0, 0.7)', border: '1px solid rgba(255, 255, 255, 0.2)',
                color: 'white', padding: '0.5rem', borderRadius: '4px', cursor: 'pointer', backdropFilter: 'blur(4px)'
              }}
            >
              <option value="drone">DRONE FEED</option>
              <option value="webcam">WEBCAM</option>
              <option value="upload">UPLOAD VIDEO</option>
            </select>
        </div>
        
        {/* Global Stats Overlay */}
        <div style={{ position: 'absolute', top: '3.5rem', right: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end', pointerEvents: 'none' }}>
            <div className="panel" style={{ padding: '0.25rem 0.5rem', display: 'flex', gap: '0.5rem', background: 'rgba(0,0,0,0.7)', color: 'white' }}>
                <Users size={14} /><span style={{fontWeight:700}}>{totalPeople}</span><span style={{opacity:0.8, fontSize:'0.7rem'}}>DETECTED</span>
            </div>
             <div className="panel" style={{ padding: '0.25rem 0.5rem', display: 'flex', gap: '0.5rem', background: 'rgba(0,0,0,0.7)', color: 'white' }}>
                <Activity size={14} /><span style={{fontWeight:700}}>{(globalDensity * 100).toFixed(0)}%</span><span style={{opacity:0.8, fontSize:'0.7rem'}}>DENSITY</span>
            </div>
            <div className="panel" style={{ padding: '0.25rem 0.5rem', display: 'flex', gap: '0.5rem', background: getRiskColor(globalRiskLevel), color: 'white' }}>
                <AlertTriangle size={14} /><span style={{fontWeight:700, textTransform:'uppercase'}}>{globalRiskLevel} RISK</span>
            </div>
        </div>
        
        {/* Hidden Input */}
        <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="video/*" style={{ display: 'none' }} />

      </div>
    </div>
  );
};

export default CrowdLiveView;
