import React, { useState } from 'react';
import { Eye, Thermometer, Moon, Video, AlertTriangle, Maximize2, Settings, Activity } from 'lucide-react';

const VideoFeed = () => {
  const [viewMode, setViewMode] = useState('standard'); // standard, thermal, night
  const [isLive] = useState(true);

  // Mock video source - in a real app this would be a stream URL
  const getVideoSource = () => {
    switch (viewMode) {
      case 'thermal':
        return 'linear-gradient(45deg, #1a1a1a, #404040)';
      case 'night':
        return 'linear-gradient(to bottom, #000000, #171717)';
      default:
        return 'linear-gradient(to bottom right, #262626, #404040)';
    }
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
            <span style={{ fontWeight: 600, fontSize: '0.8rem' }}>FEED_01</span>
          </div>
          {isLive && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--success)', animation: 'pulse 2s infinite' }}></div>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--success)' }}>LIVE</span>
            </div>
          )}
        </div>
        
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          <button 
            className={`btn ${viewMode === 'standard' ? 'btn-primary' : ''}`}
            onClick={() => setViewMode('standard')}
            title="Standard View"
          >
            <Eye size={14} /> STD
          </button>
          <button 
            className={`btn ${viewMode === 'thermal' ? 'btn-primary' : ''}`}
            onClick={() => setViewMode('thermal')}
            title="Thermal View"
          >
            <Thermometer size={14} /> THM
          </button>
          <button 
            className={`btn ${viewMode === 'night' ? 'btn-primary' : ''}`}
            onClick={() => setViewMode('night')}
            title="Night Vision"
          >
            <Moon size={14} /> NVIS
          </button>
          <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)', margin: '0 0.25rem' }}></div>
          <button className="btn" title="Settings"><Settings size={14} /></button>
          <button className="btn" title="Fullscreen"><Maximize2 size={14} /></button>
        </div>
      </div>

      {/* Video Area */}
      <div style={{ 
        flex: 1, 
        background: '#000', 
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {/* Placeholder for actual video stream */}
        <div style={{
          width: '100%',
          height: '100%',
          background: getVideoSource(),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'rgba(255,255,255,0.2)',
          flexDirection: 'column',
          gap: '1rem'
        }}>
          <Activity size={64} strokeWidth={1} />
        </div>

        {/* HUD Overlay - Top Left */}
        <div style={{
          position: 'absolute',
          top: '1rem',
          left: '1rem',
          fontFamily: 'monospace',
          color: 'rgba(255,255,255,0.8)',
          fontSize: '0.7rem',
          lineHeight: '1.4',
          textShadow: '0 1px 2px rgba(0,0,0,0.8)'
        }}>
          <p>CAM_ID: 8492-A</p>
          <p>RES: 3840x2160</p>
          <p>FPS: 59.94</p>
          <p>BITRATE: 12MBPS</p>
        </div>

        {/* HUD Overlay - Top Right */}
        <div style={{
          position: 'absolute',
          top: '1rem',
          right: '1rem',
          fontFamily: 'monospace',
          color: 'rgba(255,255,255,0.8)',
          fontSize: '0.7rem',
          textAlign: 'right',
          textShadow: '0 1px 2px rgba(0,0,0,0.8)'
        }}>
          <p>LAT: 43.6532° N</p>
          <p>LNG: 79.3832° W</p>
          <p>ALT: 120M</p>
          <p>SPD: 0KM/H</p>
        </div>

        {/* HUD Overlay - Bottom Left */}
        <div style={{
          position: 'absolute',
          bottom: '1rem',
          left: '1rem',
          display: 'flex',
          gap: '0.5rem'
        }}>
          <div style={{ padding: '0.25rem 0.5rem', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '2px', color: 'white', fontSize: '0.7rem' }}>
            ISO 800
          </div>
          <div style={{ padding: '0.25rem 0.5rem', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '2px', color: 'white', fontSize: '0.7rem' }}>
            F/2.8
          </div>
        </div>

        {/* Alert Overlay */}
        <div style={{
          position: 'absolute',
          bottom: '2rem',
          right: '2rem',
          background: 'rgba(220, 38, 38, 0.9)',
          padding: '0.5rem 1rem',
          borderRadius: '2px',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          border: '1px solid rgba(255,255,255,0.2)',
          boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
        }}>
          <AlertTriangle size={20} />
          <div>
            <p style={{ fontWeight: '700', fontSize: '0.8rem', textTransform: 'uppercase' }}>High Density Alert</p>
            <p style={{ fontSize: '0.7rem', opacity: 0.9 }}>ZONE_B • 95% CAP</p>
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

export default VideoFeed;
