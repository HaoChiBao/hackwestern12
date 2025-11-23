import React, { useState, useRef, useEffect } from 'react';
import { Eye, Video, Maximize2, Settings, Activity, Users, AlertTriangle, MapPin } from 'lucide-react';

const CrowdLiveView = ({ globalStats, pins, setPins, onPinStatsUpdate, onPinAlert, highlightedPinId }) => {
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [isPinMode, setIsPinMode] = useState(false);
  const [nextPinName, setNextPinName] = useState('');
  const videoRef = useRef(null);
  const blobsRef = useRef([]);
  const requestRef = useRef();
  const pinRiskDurations = useRef({}); // Track how long a pin has been at risk

  // Initialize Blobs
  useEffect(() => {
    const initBlobs = () => {
      const blobs = [];
      for (let i = 0; i < 15; i++) {
        blobs.push({
          x: Math.random() * 100,
          y: Math.random() * 100,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5,
          radius: 10 + Math.random() * 15,
          intensity: 0.5 + Math.random() * 0.5
        });
      }
      blobsRef.current = blobs;
    };
    initBlobs();
  }, []);

  // Animation Loop
  useEffect(() => {
    const animate = () => {
      // Update Blob Positions
      blobsRef.current.forEach(blob => {
        blob.x += blob.vx;
        blob.y += blob.vy;

        // Bounce off walls
        if (blob.x < 0 || blob.x > 100) blob.vx *= -1;
        if (blob.y < 0 || blob.y > 100) blob.vy *= -1;
      });

      // Calculate Pin Stats based on heatmap density at pin location
      if (onPinStatsUpdate) {
        if (pins.length === 0) {
          onPinStatsUpdate([]);
        } else {
          const newStats = pins.map(pin => {
            let density = 0;
            
            // Sum influence from blobs
            blobsRef.current.forEach(blob => {
              const dx = pin.x - blob.x;
              const dy = pin.y - blob.y;
              const dist = Math.sqrt(dx*dx + dy*dy);
              if (dist < blob.radius) {
                density += (1 - dist / blob.radius) * blob.intensity;
              }
            });

            // Normalize
            density = Math.min(1, density);
            
            // Determine Risk
            let riskLevel = 'low';
            if (density > 0.8) riskLevel = 'critical';
            else if (density > 0.6) riskLevel = 'high';
            else if (density > 0.3) riskLevel = 'medium';

            // Alert Logic: Track duration of high/critical risk
            if (riskLevel === 'high' || riskLevel === 'critical') {
              if (!pinRiskDurations.current[pin.id]) {
                pinRiskDurations.current[pin.id] = { startTime: Date.now(), notified: false };
              } else {
                const duration = Date.now() - pinRiskDurations.current[pin.id].startTime;
                if (duration > 3000 && !pinRiskDurations.current[pin.id].notified) {
                  // Trigger Alert
                  if (onPinAlert) {
                    onPinAlert({
                      id: `${Date.now()}-${pin.id}`,
                      timestamp: Date.now(),
                      zoneId: pin.id,
                      zoneName: pin.name,
                      severity: riskLevel,
                      message: `Sustained ${riskLevel.toUpperCase()} density detected in ${pin.name}.`,
                      snapshotColor: riskLevel === 'critical' ? '#ef4444' : '#f59e0b'
                    });
                  }
                  pinRiskDurations.current[pin.id].notified = true; // Prevent spam
                }
              }
            } else {
              // Reset if risk drops
              delete pinRiskDurations.current[pin.id];
            }

            return {
              id: pin.id,
              name: pin.name,
              peopleCount: Math.floor(density * 150), // Estimate count
              density: density,
              netFlow: Math.floor((Math.random() - 0.5) * 10),
              avgSpeed: Math.max(0.1, 1 - density),
              riskLevel
            };
          });
          onPinStatsUpdate(newStats);
        }
      }

      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [pins, onPinStatsUpdate, onPinAlert]);

  if (!globalStats) return <div className="panel" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Initializing Feed...</div>;

  const { totalPeople, globalDensity, globalRiskLevel } = globalStats;

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

  return (
    <div className="panel" style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
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
            <span style={{ fontWeight: 600, fontSize: '0.8rem' }}>DRONE_FEED_01</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--success)', animation: 'pulse 2s infinite' }}></div>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--success)' }}>LIVE</span>
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
          <button className="btn" title="Settings"><Settings size={14} /></button>
          <button className="btn" title="Fullscreen"><Maximize2 size={14} /></button>
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
      >
        {/* Simulated Video Content (Gradient) */}
        <div style={{
          width: '100%',
          height: '100%',
          background: 'linear-gradient(to bottom right, #262626, #404040)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'rgba(255,255,255,0.1)',
          flexDirection: 'column',
          gap: '1rem'
        }}>
          <Activity size={64} strokeWidth={1} />
        </div>

        {/* High-Res Blob Heatmap Overlay */}
        {showHeatmap && (
          <div style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            display: 'grid',
            gridTemplateColumns: 'repeat(60, 1fr)', // High resolution
            gridTemplateRows: 'repeat(40, 1fr)',
            opacity: 0.5,
            pointerEvents: 'none'
          }}>
            {Array.from({ length: 2400 }).map((_, i) => {
              const row = Math.floor(i / 60);
              const col = i % 60;
              const cellX = (col / 60) * 100;
              const cellY = (row / 40) * 100;

              let density = 0;

              // Calculate density from blobs
              blobsRef.current.forEach(blob => {
                const dx = cellX - blob.x;
                const dy = cellY - blob.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                if (dist < blob.radius) {
                  density += (1 - dist / blob.radius) * blob.intensity;
                }
              });

              // Pin Boost (Increased Sensitivity)
              pins.forEach(pin => {
                const dx = cellX - pin.x;
                const dy = cellY - pin.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                if (dist < 12) { // Increased radius
                  density += (12 - dist) / 12 * 1.0; // Increased boost
                }
              });

              let color = 'transparent';
              if (density > 0.8) color = 'rgba(220, 38, 38, 0.8)';
              else if (density > 0.5) color = 'rgba(234, 179, 8, 0.6)';
              else if (density > 0.2) color = 'rgba(34, 197, 94, 0.4)';

              if (color === 'transparent') return null; // Optimization

              return (
                <div key={i} style={{ backgroundColor: color }}></div>
              );
            })}
          </div>
        )}

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

        {/* HUD Overlay - Top Left */}
        <div style={{
          position: 'absolute',
          top: '1rem',
          left: '1rem',
          fontFamily: 'monospace',
          color: 'rgba(255,255,255,0.8)',
          fontSize: '0.7rem',
          lineHeight: '1.4',
          textShadow: '0 1px 2px rgba(0,0,0,0.8)',
          pointerEvents: 'none'
        }}>
          <p>CAM_ID: 8492-A</p>
          <p>RES: 4K</p>
          <p>FPS: 60</p>
        </div>

        {/* Global Metrics Badges - Top Right */}
        <div style={{
          position: 'absolute',
          top: '1rem',
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
    </div>
  );
};

export default CrowdLiveView;
