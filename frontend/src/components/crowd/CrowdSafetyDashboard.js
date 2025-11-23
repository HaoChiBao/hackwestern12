import React, { useState, useEffect } from 'react';
import { useCrowdStream } from '../../hooks/useCrowdStream';
import CrowdLiveView from './CrowdLiveView';
import CrowdZoneCards from './CrowdZoneCards';
import CrowdTimeSeries from './CrowdTimeSeries';
import CrowdAlertsPanel from './CrowdAlertsPanel';
import SessionControl from './SessionControl';

const CrowdSafetyDashboard = ({ sessionName, setSessionName, onAlertsUpdate, onSessionEnd }) => {
  const { current, history, alerts: globalAlerts, heatmapGrid, isConnected, sendFrame, clearAlert } = useCrowdStream();
  const [pins, setPins] = useState([]);
  const [pinStats, setPinStats] = useState([]);
  const [pinAlerts, setPinAlerts] = useState([]);
  const [highlightedPinId, setHighlightedPinId] = useState(null);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState(null);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [recordedChunks, setRecordedChunks] = useState([]);
  const [sessionVideoUrl, setSessionVideoUrl] = useState(null);

  const updatePinName = (id, newName) => {
    setPins(pins.map(p => p.id === id ? { ...p, name: newName } : p));
  };

  const handlePinAlert = (newAlert) => {
    setPinAlerts(prev => {
      // Avoid duplicates (simple check by ID suffix)
      if (prev.some(a => a.zoneId === newAlert.zoneId && Date.now() - a.timestamp < 5000)) return prev;
      return [newAlert, ...prev].slice(0, 20);
    });
  };

  const handleAlertClick = (zoneId) => {
    if (zoneId) {
      setHighlightedPinId(zoneId);
      setTimeout(() => setHighlightedPinId(null), 2000); // Reset after 2s
    }
  };

  const handleResolveAlert = (alertId) => {
    // Check if it's a pin alert first
    const pinAlert = pinAlerts.find(a => a.id === alertId);
    if (pinAlert) {
      if (pinAlert.onResolve) {
        pinAlert.onResolve();
      }
      setPinAlerts(prev => prev.filter(a => a.id !== alertId));
      return;
    }
    
    // Otherwise, it's a global alert - use clearAlert from hook
    if (clearAlert) {
      clearAlert(alertId);
    }
  };

  const handleEndSession = (sessionData) => {
    // Stop recording
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    
    // Create video blob from chunks
    if (recordedChunks.length > 0) {
      const blob = new Blob(recordedChunks, { type: 'video/webm' });
      const videoUrl = URL.createObjectURL(blob);
      
      // Add video to session data
      sessionData.videoUrl = videoUrl;
      sessionData.videoBlob = blob;
      
      setSessionVideoUrl(videoUrl);
      
      // Save video file
      const a = document.createElement('a');
      a.href = videoUrl;
      a.download = `session_${sessionData.name}_${new Date().toISOString()}.webm`;
      a.click();
    }
    
    // Reset recording state
    setRecordedChunks([]);
    setMediaRecorder(null);
    
    if (onSessionEnd) {
      onSessionEnd(sessionData);
    }
  };

  const handleStartSession = () => {
    setSessionStartTime(Date.now());
    setIsSessionActive(true);
    
    // Start recording video stream
    const videoElement = document.querySelector('#live-video-feed');
    const webcamElement = document.querySelector('video');
    
    let stream = null;
    if (webcamElement && webcamElement.srcObject) {
      // Recording webcam
      stream = webcamElement.srcObject;
    } else if (videoElement) {
      // Recording MJPEG stream - capture canvas
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = 640;
      canvas.height = 360;
      
      // Capture stream from canvas
      stream = canvas.captureStream(30); // 30 FPS
      
      // Continuously draw video to canvas
      const drawFrame = () => {
        if (videoElement) {
          ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
          if (isSessionActive) {
            requestAnimationFrame(drawFrame);
          }
        }
      };
      drawFrame();
    }
    
    if (stream) {
      try {
        const recorder = new MediaRecorder(stream, {
          mimeType: 'video/webm;codecs=vp8'
        });
        
        const chunks = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            chunks.push(e.data);
            setRecordedChunks(prev => [...prev, e.data]);
          }
        };
        
        recorder.start(1000); // Capture every second
        setMediaRecorder(recorder);
        console.log('Session recording started');
      } catch (e) {
        console.error('Failed to start recording:', e);
      }
    }
  };

  // Merge alerts with useMemo to prevent infinite loop
  const allAlerts = React.useMemo(() => {
    return [...pinAlerts, ...globalAlerts].sort((a, b) => b.timestamp - a.timestamp);
  }, [pinAlerts, globalAlerts]);

  // Update parent with alerts for reports
  useEffect(() => {
    if (onAlertsUpdate) {
      onAlertsUpdate(allAlerts);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allAlerts]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', height: '100%' }}>
      {/* Left Column: Live View & Zone Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: 0, minWidth: 0 }}>
        {/* Live View - takes up remaining space */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <CrowdLiveView 
            globalStats={current} 
            pins={pins}
            setPins={setPins}
            onPinStatsUpdate={setPinStats}
            onPinAlert={handlePinAlert}
            highlightedPinId={highlightedPinId}
            heatmapGrid={heatmapGrid}
            isConnected={isConnected}
            sendFrame={sendFrame}
          />
        </div>
        
        {/* Zone Cards at bottom */}
        <div style={{ flexShrink: 0, width: '100%', maxWidth: '100%', overflow: 'hidden' }}>
          <CrowdZoneCards 
            zones={pinStats} 
            onRename={updatePinName}
            onRemove={(id) => setPins(pins.filter(p => p.id !== id))}
          />
        </div>
      </div>

      {/* Right Column: Session Control, Charts & Alerts */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: 0 }}>
        {/* Session Control */}
        <div style={{ flexShrink: 0 }}>
          <SessionControl
            sessionName={sessionName}
            setSessionName={setSessionName}
            isSessionActive={isSessionActive}
            setIsSessionActive={setIsSessionActive}
            sessionStartTime={sessionStartTime}
            setSessionStartTime={setSessionStartTime}
            onStartSession={handleStartSession}
            onEndSession={handleEndSession}
            alerts={allAlerts}
          />
        </div>

        {/* Time Series Chart - Increased for better visibility */}
        <div style={{ height: '220px', flexShrink: 0 }}>
          <CrowdTimeSeries history={history} />
        </div>

        {/* Alerts Panel - fills remaining space (more space now) */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <CrowdAlertsPanel 
            alerts={allAlerts} 
            onAlertClick={handleAlertClick} 
            onResolveAlert={handleResolveAlert}
          />
        </div>
      </div>
    </div>
  );
};

export default CrowdSafetyDashboard;
