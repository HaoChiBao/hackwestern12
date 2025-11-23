import React, { useState } from 'react';
import { FileText, Download, Edit2, Save, ArrowLeft, Check, X, Trash2 } from 'lucide-react';
import MarkdownRenderer from '../common/MarkdownRenderer';

const ReportsPage = ({ sessions, onRenameReport, onSaveReport, onDeleteReport }) => {
  const [selectedReport, setSelectedReport] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedReport, setEditedReport] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');

  // Sessions that have a report
  const sessionsWithReports = sessions.filter(s => s.report);

  const handleSelectReport = (session) => {
    setSelectedReport(session);
    setEditedReport(session.report);
    setEditedTitle(session.name);
    setIsEditing(false);
    setIsEditingTitle(false);
  };

  const handleSave = () => {
    if (onSaveReport && selectedReport) {
      onSaveReport(selectedReport.id, editedReport);
      setSelectedReport({ ...selectedReport, report: editedReport });
    }
    setIsEditing(false);
  };

  const handleSaveTitle = () => {
    if (onRenameReport && selectedReport && editedTitle.trim()) {
      onRenameReport(selectedReport.id, editedTitle.trim());
      setSelectedReport({ ...selectedReport, name: editedTitle.trim() });
    }
    setIsEditingTitle(false);
  };

  const handleCancelTitle = () => {
    setEditedTitle(selectedReport.name);
    setIsEditingTitle(false);
  };

  const handleDownload = () => {
    const blob = new Blob([editedReport], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedReport.name}-${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleBack = () => {
    setSelectedReport(null);
    setIsEditing(false);
  };

  const handleDeleteReport = () => {
    if (onDeleteReport && selectedReport) {
      onDeleteReport(selectedReport.id);
    }
    handleBack();
  };

  // List view
  if (!selectedReport) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
        {/* Header */}
        <div className="panel" style={{ padding: '0.75rem 1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <FileText size={18} />
            <h2 style={{ fontSize: '1rem', fontWeight: 700 }}>AI Reports</h2>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
            {sessionsWithReports.length} report{sessionsWithReports.length !== 1 ? 's' : ''} available
          </p>
        </div>

        {/* Reports List */}
        {sessionsWithReports.length === 0 ? (
          <div className="panel" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed' }}>
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
              <FileText size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
              <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>No Reports Generated</p>
              <p style={{ fontSize: '0.75rem' }}>Generate a report from a session to view it here</p>
            </div>
          </div>
        ) : (
          <div className="panel" style={{ flex: 1, overflow: 'auto', padding: '0' }}>
            {sessionsWithReports.map(session => (
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
                onClick={() => handleSelectReport(session)}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <div>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.25rem' }}>{session.name}</h4>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{session.date} • {session.totalAlerts} alerts</div>
                </div>
                <button className="btn" onClick={e => { e.stopPropagation(); handleDeleteReport(session.id); }} style={{ padding: '0.25rem 0.5rem' }}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Detail view
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
      {/* Header with Title */}
      <div className="panel" style={{ padding: '0.75rem 1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <button className="btn" onClick={handleBack} style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}>
            <ArrowLeft size={14} /> Back
          </button>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {isEditing && (
              <button className="btn" onClick={handleSave} style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}>
                <Save size={14} /> Save Changes
              </button>
            )}
            <button className="btn" onClick={() => setIsEditing(!isEditing)} style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}>
              <Edit2 size={14} /> {isEditing ? 'Cancel' : 'Edit'}
            </button>
            <button className="btn btn-primary" onClick={handleDownload} style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}>
              <Download size={14} /> Download
            </button>
            <button className="btn btn-danger" onClick={handleDeleteReport} style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}>
              <Trash2 size={14} /> Delete
            </button>
          </div>
        </div>

        {/* Editable Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {isEditingTitle ? (
            <>
              <input
                type="text"
                value={editedTitle}
                onChange={e => setEditedTitle(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleSaveTitle();
                  if (e.key === 'Escape') handleCancelTitle();
                }}
                style={{
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  fontSize: '1rem',
                  fontWeight: 700,
                  padding: '0.25rem 0.5rem',
                  borderRadius: '2px',
                  outline: 'none',
                  flex: 1
                }}
                autoFocus
              />
              <button onClick={handleSaveTitle} className="btn" style={{ padding: '0.35rem 0.5rem', fontSize: '0.7rem' }}>
                <Check size={14} />
              </button>
              <button onClick={handleCancelTitle} className="btn" style={{ padding: '0.35rem 0.5rem', fontSize: '0.7rem' }}>
                <X size={14} />
              </button>
            </>
          ) : (
            <>
              <h2 style={{ fontSize: '1rem', fontWeight: 700 }}>{selectedReport.name}</h2>
              <button onClick={() => setIsEditingTitle(true)} className="btn" style={{ padding: '0.25rem 0.4rem', opacity: 0.6 }}
                onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}
              >
                <Edit2 size={12} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Report Content */}
      <div className="panel" style={{ flex: 1, overflow: 'auto', padding: '1rem' }}>
        {isEditing ? (
          <textarea
            value={editedReport}
            onChange={e => setEditedReport(e.target.value)}
            style={{
              width: '100%',
              height: '100%',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              fontSize: '0.8rem',
              fontFamily: 'monospace',
              lineHeight: 1.6,
              padding: '1rem',
              borderRadius: '2px',
              outline: 'none',
              resize: 'none'
            }}
          />
        ) : (
          <MarkdownRenderer content={editedReport} />
        )}
      </div>
    </div>
  );
};

export default ReportsPage;
