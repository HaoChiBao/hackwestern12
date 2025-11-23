import React, { useState, useEffect } from 'react';
import { useFakeCrowdStream } from '../../hooks/useFakeCrowdStream';
import CrowdLiveView from './CrowdLiveView';
import CrowdZoneCards from './CrowdZoneCards';
import CrowdTimeSeries from './CrowdTimeSeries';
import CrowdAlertsPanel from './CrowdAlertsPanel';
import SessionControl from './SessionControl';

const CrowdSafetyDashboard = ({ sessionName, setSessionName, onAlertsUpdate, onSessionEnd }) => {
  const { current, history, alerts: globalAlerts } = useFakeCrowdStream(1000);
  const [pins, setPins] = useState([]);
  const [pinStats, setPinStats] = useState([]);
  const [pinAlerts, setPinAlerts] = useState([]);
  const [highlightedPinId, setHighlightedPinId] = useState(null);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState(null);

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
    setPinAlerts(prev => prev.filter(a => a.id !== alertId));
  };

  const handleEndSession = (sessionData) => {
    if (onSessionEnd) {
      onSessionEnd(sessionData);
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: 0 }}>
        {/* Live View - takes up remaining space */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <CrowdLiveView 
            globalStats={current} 
            pins={pins}
            setPins={setPins}
            onPinStatsUpdate={setPinStats}
            onPinAlert={handlePinAlert}
            highlightedPinId={highlightedPinId}
          />
        </div>
        
        {/* Zone Cards at bottom */}
        <div style={{ flexShrink: 0 }}>
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
