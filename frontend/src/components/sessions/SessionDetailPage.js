import React, { useState } from 'react';
import { ArrowLeft, FileText, Calendar, Clock, AlertCircle, AlertTriangle, Info, Loader, Edit2, Check, X } from 'lucide-react';
import { generateReportStreaming } from '../../services/openai';
import MarkdownRenderer from '../common/MarkdownRenderer';

const SessionDetailPage = ({ session, onBack, onReportGenerated, onRenameSession, onSaveReport }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [report, setReport] = useState(session.report || '');
  const [error, setError] = useState(null);
  const [showReportPanel, setShowReportPanel] = useState(!!session.report);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(session.name);

  const hasApiKey = !!process.env.REACT_APP_OPENAI_API_KEY;

  const handleGenerateReport = async () => {
    console.log('[Report Generation] Starting...');
    console.log('[Report Generation] Session:', session.name);
    console.log('[Report Generation] Alerts count:', session.alerts?.length || 0);
    
    setIsGenerating(true);
    setShowReportPanel(true);
    setError(null);
    setReport('');

    let fullReport = '';

    try {
      console.log('[Report Generation] Calling OpenAI API...');
      await generateReportStreaming(
        session.name, 
        session.alerts || [],
        (chunk) => {
          console.log('[Report Generation] Received chunk:', chunk.substring(0, 50) + '...');
          fullReport += chunk;
          setReport(prev => prev + chunk);
        }
      );
      console.log('[Report Generation] Completed successfully');
      console.log('[Report Generation] Full report length:', fullReport.length);
      
      // Save report to session immediately
      if (onSaveReport) {
        onSaveReport(session.id, fullReport);
      }
      
      if (onReportGenerated) {
        onReportGenerated(fullReport);
      }
    } catch (err) {
      console.error('[Report Generation] Error:', err);
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveRename = () => {
    if (editName.trim() && onRenameSession) {
      onRenameSession(session.id, editName.trim());
      setIsEditingName(false);
    }
  };

  const handleCancelRename = () => {
    setEditName(session.name);
    setIsEditingName(false);
  };

  const formatDuration = (duration) => {
    if (!duration) return 'N/A';
    const totalSeconds = Math.floor(duration / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const alertBreakdown = React.useMemo(() => {
    const alerts = session.alerts || [];
    return alerts.reduce((acc, a) => {
      acc.total++;
      if (a.severity === 'critical') acc.critical++;
      else if (a.severity === 'high') acc.high++;
      else if (a.severity === 'medium') acc.medium++;
      else acc.low++;
      return acc;
    }, { total: 0, critical: 0, high: 0, medium: 0, low: 0 });
  }, [session.alerts]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
      {/* Header with Generate Button */}
      <div className="panel" style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
          <button 
            className="btn" 
            onClick={onBack}
            style={{ fontSize: '0.75rem' }}
          >
            <ArrowLeft size={14} /> Back
          </button>
          
          <button
            className="btn btn-primary"
            onClick={handleGenerateReport}
            disabled={isGenerating || !hasApiKey}
            style={{ fontSize: '0.75rem' }}
          >
            {isGenerating ? (
              <>
                <Loader size={14} className="spinner" /> Generating...
              </>
            ) : (
              <>
                <FileText size={14} /> Generate AI Report
              </>
            )}
          </button>
        </div>


        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          {isEditingName ? (
            <>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveRename();
                  if (e.key === 'Escape') handleCancelRename();
                }}
                style={{
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  fontSize: '1.1rem',
                  fontWeight: 700,
                  padding: '0.25rem 0.5rem',
                  borderRadius: '2px',
                  outline: 'none',
                  flex: 1
                }}
                autoFocus
              />
              <button
                onClick={handleSaveRename}
                className="btn"
                style={{ padding: '0.35rem 0.5rem', fontSize: '0.7rem' }}
              >
                <Check size={14} />
              </button>
              <button
                onClick={handleCancelRename}
                className="btn"
                style={{ padding: '0.35rem 0.5rem', fontSize: '0.7rem' }}
              >
                <X size={14} />
              </button>
            </>
          ) : (
            <>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{session.name}</h2>
              <button
                onClick={() => setIsEditingName(true)}
                className="btn"
                style={{ padding: '0.25rem 0.4rem', opacity: 0.6 }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = 1}
                onMouseLeave={(e) => e.currentTarget.style.opacity = 0.6}
              >
                <Edit2 size={14} />
              </button>
            </>
          )}
        </div>
        <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Calendar size={12} />
            <span>{session.date}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Clock size={12} />
            <span>{session.time}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Clock size={12} />
            <span>Duration: {formatDuration(session.duration)}</span>
          </div>
        </div>

        {/* Compact Alert Summary */}
        <div style={{ 
          marginTop: '0.75rem', 
          paddingTop: '0.75rem', 
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          gap: '1.5rem',
          fontSize: '0.75rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Total:</span>
            <span style={{ fontWeight: 600 }}>{alertBreakdown.total}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <AlertCircle size={12} color="var(--danger)" />
            <span style={{ color: 'var(--text-secondary)' }}>Critical:</span>
            <span style={{ fontWeight: 700, color: 'var(--danger)' }}>{alertBreakdown.critical}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <AlertTriangle size={12} color="var(--warning)" />
            <span style={{ color: 'var(--text-secondary)' }}>High:</span>
            <span style={{ fontWeight: 700, color: 'var(--warning)' }}>{alertBreakdown.high}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Info size={12} color="#f59e0b" />
            <span style={{ color: 'var(--text-secondary)' }}>Medium:</span>
            <span style={{ fontWeight: 600, color: '#f59e0b' }}>{alertBreakdown.medium}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Info size={12} color="var(--text-secondary)" />
            <span style={{ color: 'var(--text-secondary)' }}>Low:</span>
            <span style={{ fontWeight: 600 }}>{alertBreakdown.low}</span>
          </div>
        </div>

        {error && (
          <div style={{ marginTop: '0.75rem', padding: '0.5rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger)', borderRadius: '2px', fontSize: '0.75rem', color: 'var(--danger)' }}>
            {error}
          </div>
        )}
      </div>

      {/* Split View: Logs + Report */}
      <div style={{ 
        flex: 1, 
        display: 'grid', 
        gridTemplateColumns: showReportPanel ? '1fr 1fr' : '1fr', 
        gap: '1rem', 
        minHeight: 0,
        transition: 'grid-template-columns 0.3s ease-in-out'
      }}>
        {/* Session Logs */}
        <div className="panel" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }}>
            <h3 style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>Session Logs</h3>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: '0' }}>
            {(!session.alerts || session.alerts.length === 0) ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <p style={{ fontSize: '0.8rem' }}>No alerts recorded during this session.</p>
              </div>
            ) : (
              session.alerts.map((alert, index) => (
                <div 
                  key={index}
                  style={{
                    padding: '0.75rem',
                    borderBottom: '1px solid var(--border-color)',
                    fontSize: '0.75rem'
                  }}
                >
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                    <div style={{ marginTop: '2px' }}>
                      {alert.severity === 'critical' ? <AlertCircle size={12} color="var(--danger)" /> :
                       alert.severity === 'high' ? <AlertTriangle size={12} color="var(--warning)" /> :
                       <Info size={12} color="var(--text-secondary)" />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.75rem' }}>{alert.zoneName || 'System'}</span>
                        <span style={{ fontFamily: 'monospace', color: 'var(--text-secondary)', fontSize: '0.65rem' }}>
                          {new Date(alert.timestamp).toLocaleTimeString([], { hour12: false })}
                        </span>
                      </div>
                      <p style={{ color: 'var(--text-primary)', lineHeight: 1.4, fontSize: '0.75rem' }}>{alert.message}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Generated Report with Loading Placeholder */}
        {showReportPanel && (
          <div className="panel report-panel-enter" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase' }}>Generated Report</h3>
                {isGenerating && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Loader size={14} className="spinner" />
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Generating...</span>
                  </div>
                )}
              </div>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '1rem' }}>
              {isGenerating && !report ? (
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: 1.8 }}>
                  <div className="loading-line" style={{ width: '90%', height: '12px', backgroundColor: 'var(--bg-tertiary)', marginBottom: '0.5rem', borderRadius: '2px' }}></div>
                  <div className="loading-line" style={{ width: '85%', height: '12px', backgroundColor: 'var(--bg-tertiary)', marginBottom: '0.5rem', borderRadius: '2px' }}></div>
                  <div className="loading-line" style={{ width: '92%', height: '12px', backgroundColor: 'var(--bg-tertiary)', marginBottom: '0.5rem', borderRadius: '2px' }}></div>
                  <div className="loading-line" style={{ width: '88%', height: '12px', backgroundColor: 'var(--bg-tertiary)', marginBottom: '1rem', borderRadius: '2px' }}></div>
                  <div className="loading-line" style={{ width: '80%', height: '12px', backgroundColor: 'var(--bg-tertiary)', marginBottom: '0.5rem', borderRadius: '2px' }}></div>
                  <div className="loading-line" style={{ width: '95%', height: '12px', backgroundColor: 'var(--bg-tertiary)', marginBottom: '0.5rem', borderRadius: '2px' }}></div>
                  <div className="loading-line" style={{ width: '87%', height: '12px', backgroundColor: 'var(--bg-tertiary)', marginBottom: '0.5rem', borderRadius: '2px' }}></div>
                </div>
              ) : (
                <div>
                  <MarkdownRenderer content={report} />
                  {isGenerating && <span className="cursor-blink">▊</span>}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <style>{`
        .spinner {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .cursor-blink {
          animation: blink 1s infinite;
        }
        @keyframes blink {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
        .loading-line {
          animation: pulse 1.5s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.6; }
        }
        .report-panel-enter {
          animation: slideIn 0.3s ease-out;
        }
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
};

export default SessionDetailPage;
