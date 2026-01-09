import React, { useMemo } from 'react';
import { Database, Calendar, AlertCircle, Clock, Trash2 } from 'lucide-react';

const DroneSessionsPage = ({ sessions = [], onViewSession, onDeleteSession }) => {
  const hasRealSessions = sessions && sessions.length > 0;

  // Aggregate statistics
  const stats = useMemo(() => {
    return sessions.reduce(
      (acc, s) => {
        acc.totalAlerts += s.totalAlerts || 0;
        acc.criticalAlerts += s.criticalAlerts || 0;
        return acc;
      },
      { totalAlerts: 0, criticalAlerts: 0 }
    );
  }, [sessions]);

  const formatDuration = duration => {
    if (!duration) return 'N/A';
    const totalSeconds = Math.floor(duration / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const handleDelete = sessionId => {
    if (onDeleteSession) {
      onDeleteSession(sessionId);
    }
  };

  // List view
  if (!hasRealSessions) {
    return (
      <div className="panel" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <p>No drone sessions recorded yet.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
      {/* Header */}
      <div className="panel" style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <Database size={20} />
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Drone Session History</h2>
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          View and manage previous surveillance sessions – click to view details.
        </p>
      </div>

      {/* Compact Stats */}
      <div className="panel" style={{ padding: '0.75rem 1rem' }}>
        <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Total Sessions</p>
            <p style={{ fontSize: '1.2rem', fontWeight: 700 }}>{sessions.length}</p>
          </div>
          <div>
            <p style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Total Alerts</p>
            <p style={{ fontSize: '1.2rem', fontWeight: 700 }}>{stats.totalAlerts}</p>
          </div>
          <div>
            <p style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Critical Events</p>
            <p style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--danger)' }}>{stats.criticalAlerts}</p>
          </div>
        </div>
      </div>

      {/* Sessions List */}
      <div className="panel" style={{ flex: 1, overflow: 'auto', padding: '0' }}>
        {sessions.map(session => (
          <div
            key={session.id}
            style={{
              padding: '1rem',
              borderBottom: '1px solid var(--border-color)',
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              transition: 'background-color 0.2s'
            }}
            onClick={() => onViewSession && onViewSession(session)}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <div>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.25rem' }}>{session.name}</h4>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {session.date} • {session.totalAlerts} alerts • {formatDuration(session.duration)}
              </div>
            </div>
            <button
              className="btn"
              onClick={e => {
                e.stopPropagation();
                if (window.confirm(`Delete session "${session.name}"?`)) {
                  handleDelete(session.id);
                }
              }}
              style={{ padding: '0.25rem 0.5rem' }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DroneSessionsPage;
