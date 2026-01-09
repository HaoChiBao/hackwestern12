import React, { useState, useEffect } from 'react';
import { Play, Square, Clock, Pause } from 'lucide-react';

const SessionControl = ({ 
  sessionName, 
  setSessionName,
  isSessionActive,
  setIsSessionActive,
  sessionStartTime,
  setSessionStartTime,
  onStartSession,
  onEndSession,
  alerts
}) => {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [pausedTime, setPausedTime] = useState(0);

  // Timer update
  useEffect(() => {
    if (!isSessionActive || !sessionStartTime || isPaused) {
      return;
    }

    const interval = setInterval(() => {
      setElapsedTime(Date.now() - sessionStartTime - pausedTime);
    }, 1000);

    return () => clearInterval(interval);
  }, [isSessionActive, sessionStartTime, isPaused, pausedTime]);

  const formatTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const handleStartSession = () => {
    if (onStartSession) {
      onStartSession();
    } else {
      setSessionStartTime(Date.now());
      setIsSessionActive(true);
      setIsPaused(false);
      setPausedTime(0);
    }
  };

  const handlePauseResume = () => {
    if (isPaused) {
      // Resume
      setPausedTime(prev => prev + (Date.now() - (sessionStartTime + elapsedTime)));
      setIsPaused(false);
    } else {
      // Pause
      setIsPaused(true);
    }
  };

  const handleStopSession = () => {
    const endTime = Date.now();
    console.log('[SessionControl] Stopping session:', {
      name: sessionName,
      startTime: sessionStartTime,
      endTime: endTime,
      duration: elapsedTime,
      alertsCount: alerts.length
    });

    if (onEndSession) {
      onEndSession({
        name: sessionName,
        startTime: sessionStartTime,
        endTime: endTime,
        duration: elapsedTime,
        alerts: alerts
      });
    }
    setIsSessionActive(false);
    setSessionStartTime(null);
    setElapsedTime(0);
    setIsPaused(false);
    setPausedTime(0);
  };

  return (
    <div className="panel" style={{ padding: '0.5rem 0.75rem' }}>
      {/* Compact Session Name & Timer Row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
        <input
          type="text"
          value={sessionName}
          onChange={(e) => setSessionName(e.target.value)}
          disabled={isSessionActive}
          placeholder="Session Name"
          style={{
            flex: 1,
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-primary)',
            fontWeight: 600,
            fontSize: '0.75rem',
            padding: '0.35rem 0.5rem',
            borderRadius: '2px',
            outline: 'none',
            opacity: isSessionActive ? 0.6 : 1
          }}
        />
        <div style={{ 
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem'
        }}>
          <Clock size={12} color="var(--text-secondary)" />
          <div style={{ 
            fontFamily: 'monospace', 
            fontSize: '0.85rem', 
            fontWeight: 700,
            color: isSessionActive ? 'var(--success)' : 'var(--text-secondary)',
            minWidth: '60px'
          }}>
            {formatTime(elapsedTime)}
          </div>
        </div>
      </div>

      {/* Compact Controls */}
      <div style={{ display: 'flex', gap: '0.35rem' }}>
        {!isSessionActive ? (
          <button
            className="btn btn-primary"
            onClick={handleStartSession}
            style={{ flex: 1, justifyContent: 'center', padding: '0.35rem', fontSize: '0.75rem' }}
          >
            <Play size={12} /> Start
          </button>
        ) : (
          <>
            <button
              className="btn"
              onClick={handlePauseResume}
              style={{ 
                flex: 1, 
                justifyContent: 'center', 
                padding: '0.35rem',
                fontSize: '0.75rem',
                backgroundColor: isPaused ? 'var(--success)' : 'var(--bg-secondary)',
                color: isPaused ? 'white' : 'var(--text-primary)',
                border: '1px solid var(--border-color)'
              }}
            >
              {isPaused ? <><Play size={12} /> Resume</> : <><Pause size={12} /> Pause</>}
            </button>
            <button
              className="btn"
              onClick={handleStopSession}
              style={{ 
                flex: 1, 
                justifyContent: 'center', 
                padding: '0.35rem',
                fontSize: '0.75rem',
                backgroundColor: 'var(--danger)',
                color: 'white',
                border: 'none'
              }}
            >
              <Square size={12} /> End
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default SessionControl;
