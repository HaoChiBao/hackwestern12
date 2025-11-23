import React from 'react';
import { Users, Activity, Wind, MapPin, X } from 'lucide-react';

const ZoneCard = ({ zone, onRename, onRemove }) => {
  const getRiskColor = (level) => {
    switch (level) {
      case 'critical': return 'var(--danger)';
      case 'high': return 'var(--warning)';
      case 'medium': return '#f59e0b';
      default: return 'var(--success)';
    }
  };

  return (
    <div className="panel" style={{ 
      padding: '0.75rem', 
      display: 'flex', 
      flexDirection: 'column', 
      gap: '0.5rem',
      minWidth: '240px', // Fixed width
      flexShrink: 0,
      position: 'relative'
    }}>
      {/* Remove Button */}
      <button 
        onClick={() => onRemove(zone.id)}
        style={{
          position: 'absolute',
          top: '0.5rem',
          right: '0.5rem',
          background: 'transparent',
          border: 'none',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          padding: '2px'
        }}
        title="Remove Pin"
      >
        <X size={14} />
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingRight: '1.5rem' }}>
        <MapPin size={16} color={getRiskColor(zone.riskLevel)} />
        <input 
          type="text" 
          value={zone.name}
          onChange={(e) => onRename(zone.id, e.target.value)}
          style={{
            background: 'transparent',
            border: 'none',
            borderBottom: '1px solid transparent',
            color: 'var(--text-primary)',
            fontWeight: 600,
            fontSize: '0.9rem',
            width: '100%',
            outline: 'none',
            fontFamily: 'inherit',
            padding: '2px 0'
          }}
          onFocus={(e) => e.target.style.borderBottom = '1px solid var(--primary)'}
          onBlur={(e) => e.target.style.borderBottom = '1px solid transparent'}
        />
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.25rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Count</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <Users size={14} className="text-muted" />
            <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>{zone.peopleCount}</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Density</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <Activity size={14} className="text-muted" />
            <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>{(zone.density * 100).toFixed(0)}%</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Flow</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <Wind size={14} className="text-muted" />
            <span style={{ fontWeight: 700 }}>{zone.netFlow > 0 ? '+' : ''}{zone.netFlow}/s</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Risk</span>
          <span style={{ 
            fontWeight: 700, 
            color: getRiskColor(zone.riskLevel),
            textTransform: 'uppercase',
            fontSize: '0.8rem'
          }}>
            {zone.riskLevel}
          </span>
        </div>
      </div>
    </div>
  );
};

const CrowdZoneCards = ({ zones, onRename, onRemove }) => {
  if (!zones || zones.length === 0) {
    return (
      <div className="panel" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', borderStyle: 'dashed', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <MapPin size={24} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
        <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>NO ACTIVE PINS</p>
        <p style={{ fontSize: '0.7rem', opacity: 0.7 }}>Click "DROP PIN" on the feed to add a monitor.</p>
      </div>
    );
  }

  return (
    <div style={{ 
      width: '100%',
      display: 'flex', 
      gap: '1rem', 
      overflowX: 'auto', 
      paddingBottom: '0.5rem',
      scrollbarWidth: 'thin',
      scrollbarColor: 'var(--border-color) transparent'
    }}>
      {zones.map(zone => (
        <ZoneCard key={zone.id} zone={zone} onRename={onRename} onRemove={onRemove} />
      ))}
    </div>
  );
};

export default CrowdZoneCards;
