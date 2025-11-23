import React, { useState } from 'react';
import { AlertTriangle, Info, AlertCircle, MapPin, ChevronDown, ChevronRight, Camera, CheckCircle } from 'lucide-react';

const CrowdAlertsPanel = ({ alerts, onAlertClick, onResolveAlert }) => {
  const [expandedId, setExpandedId] = useState(null);

  const toggleExpand = (id, e) => {
    e.stopPropagation();
    setExpandedId(expandedId === id ? null : id);
  };

  // Calculate alert breakdown
  const alertBreakdown = React.useMemo(() => {
    return alerts.reduce((acc, alert) => {
      acc.total++;
      if (alert.severity === 'critical') acc.critical++;
      else if (alert.severity === 'high') acc.high++;
      else if (alert.severity === 'medium') acc.medium++;
      else acc.low++;
      return acc;
    }, { total: 0, critical: 0, high: 0, medium: 0, low: 0 });
  }, [alerts]);

  return (
    <div className="panel" style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ 
        padding: '0.5rem 0.75rem', 
        borderBottom: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-tertiary)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <h3 style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>System Logs</h3>
          <span className="badge" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>{alerts.length}</span>
        </div>
        
        {/* Compact Alert Breakdown */}
        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.7rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <AlertCircle size={10} color="var(--danger)" />
            <span style={{ color: 'var(--text-secondary)' }}>Critical:</span>
            <span style={{ fontWeight: 700, color: 'var(--danger)' }}>{alertBreakdown.critical}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <AlertTriangle size={10} color="var(--warning)" />
            <span style={{ color: 'var(--text-secondary)' }}>High:</span>
            <span style={{ fontWeight: 700, color: 'var(--warning)' }}>{alertBreakdown.high}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <Info size={10} color="#f59e0b" />
            <span style={{ color: 'var(--text-secondary)' }}>Med:</span>
            <span style={{ fontWeight: 700, color: '#f59e0b' }}>{alertBreakdown.medium}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <Info size={10} color="var(--text-secondary)" />
            <span style={{ color: 'var(--text-secondary)' }}>Low:</span>
            <span style={{ fontWeight: 600 }}>{alertBreakdown.low}</span>
          </div>
        </div>
      </div>
      
      <div style={{ flex: 1, overflow: 'auto', padding: '0' }}>
        {alerts.length === 0 ? (
          <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
            No active alerts. System nominal.
          </div>
        ) : (
          alerts.map((alert) => {
            const isExpanded = expandedId === alert.id;
            const hasSnapshot = !!alert.snapshotColor;

            return (
              <div 
                key={alert.id} 
                className="alert-item"
                style={{ 
                  borderBottom: '1px solid var(--border-color)',
                  backgroundColor: alert.severity === 'critical' ? 'rgba(220, 38, 38, 0.05)' : 'transparent',
                  transition: 'background-color 0.2s'
                }}
              >
                {/* Header Row */}
                <div 
                  style={{ 
                    display: 'flex', 
                    gap: '0.5rem', 
                    alignItems: 'center', 
                    padding: '0.5rem 0.75rem',
                    cursor: hasSnapshot ? 'pointer' : 'default'
                  }}
                  onClick={(e) => hasSnapshot && toggleExpand(alert.id, e)}
                >
                  {/* Icon */}
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    {alert.severity === 'critical' ? <AlertTriangle size={14} color="var(--danger)" /> :
                     alert.severity === 'high' ? <AlertCircle size={14} color="var(--warning)" /> :
                     <Info size={14} color="var(--text-secondary)" />}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {alert.zoneName || 'System'}
                      </span>
                      <span style={{ fontFamily: 'monospace', color: 'var(--text-secondary)', fontSize: '0.7rem', marginLeft: '0.5rem' }}>
                        {new Date(alert.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>
                    <p style={{ color: 'var(--text-primary)', fontSize: '0.75rem', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', opacity: 0.8 }}>
                      {alert.message}
                    </p>
                  </div>

                  {/* Quick Resolve Action */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onResolveAlert) onResolveAlert(alert.id);
                    }}
                    title="Resolve Alert"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      opacity: 0.6
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                    onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
                  >
                    <CheckCircle size={14} />
                  </button>

                  {/* Expand Toggle */}
                  {hasSnapshot && (
                    <div style={{ color: 'var(--text-secondary)' }}>
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </div>
                  )}
                </div>

                {/* Expanded Content */}
                {isExpanded && hasSnapshot && (
                  <div style={{ 
                    padding: '0 0.75rem 0.75rem 0.75rem', 
                    animation: 'fadeIn 0.2s ease-in-out'
                  }}>
                    <div style={{ 
                      backgroundColor: 'var(--bg-secondary)', 
                      borderRadius: '4px', 
                      padding: '0.5rem',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem'
                    }}>
                      {/* Snapshot Image */}
                      <div style={{
                        width: '100%',
                        height: '120px',
                        backgroundColor: '#171717',
                        borderRadius: '2px',
                        position: 'relative',
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid var(--border-color)'
                      }}>
                        {alert.snapshot ? (
                          <img 
                            src={alert.snapshot} 
                            alt="Alert Snapshot" 
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                            <Camera size={20} color="rgba(255,255,255,0.3)" />
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>No Snapshot Available</span>
                          </div>
                        )}
                        <span style={{ position: 'absolute', bottom: '4px', right: '4px', fontSize: '0.6rem', color: 'rgba(255,255,255,0.8)', fontFamily: 'monospace', textShadow: '0 1px 2px black' }}>REC: {alert.zoneName}</span>
                      </div>

                      {/* Action Buttons */}
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button 
                          className="btn btn-primary" 
                          style={{ flex: 1, justifyContent: 'center', fontSize: '0.75rem', padding: '0.4rem' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onAlertClick(alert.zoneId);
                          }}
                        >
                          <MapPin size={12} /> LOCATE
                        </button>
                        <button 
                          className="btn" 
                          style={{ flex: 1, justifyContent: 'center', fontSize: '0.75rem', padding: '0.4rem', border: '1px solid var(--border-color)' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onResolveAlert) onResolveAlert(alert.id);
                          }}
                        >
                          <CheckCircle size={12} /> RESOLVE
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default CrowdAlertsPanel;
