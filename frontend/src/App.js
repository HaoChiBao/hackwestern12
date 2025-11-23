import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import CrowdSafetyDashboard from './components/crowd/CrowdSafetyDashboard';
import ReportsPage from './components/reports/ReportsPage';
import DroneSessionsPage from './components/sessions/DroneSessionsPage';
import SessionDetailPage from './components/sessions/SessionDetailPage';

function App() {
  const [isDarkMode, setIsDarkMode] = useState(true); // Default to dark mode for industrial look
  const [currentPage, setCurrentPage] = useState('overview');
  const [sessionName, setSessionName] = useState('Untitled Session');
  const [generatedReport, setGeneratedReport] = useState('');
  const [completedSessions, setCompletedSessions] = useState(() => {
    // Load from localStorage
    const saved = localStorage.getItem('droneGuardSessions');
    return saved ? JSON.parse(saved) : [];
  });
  const [selectedSession, setSelectedSession] = useState(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  const handleNavigate = (page) => {
    setCurrentPage(page);
    setSelectedSession(null); // Clear selected session when navigating
  };

  const handleViewSession = (session) => {
    setSelectedSession(session);
  };

  const handleBackToSessions = () => {
    setSelectedSession(null);
  };

  const handleSessionEnd = (sessionData) => {
    console.log('[Session End] Received data:', {
      name: sessionData.name,
      startTime: sessionData.startTime,
      endTime: sessionData.endTime,
      startFormatted: new Date(sessionData.startTime).toLocaleString(),
      endFormatted: new Date(sessionData.endTime).toLocaleString()
    });

    const formattedSession = {
      id: Date.now(),
      name: sessionData.name,
      date: new Date(sessionData.startTime).toLocaleDateString(),
      time: `${new Date(sessionData.startTime).toLocaleTimeString([], { hour12: false })} - ${new Date(sessionData.endTime).toLocaleTimeString([], { hour12: false })}`,
      duration: sessionData.duration,
      totalAlerts: sessionData.alerts.length,
      criticalAlerts: sessionData.alerts.filter(a => a.severity === 'critical').length,
      status: 'completed',
      alerts: sessionData.alerts,
      report: generatedReport || null
    };

    console.log('[Session End] Formatted session:', {
      name: formattedSession.name,
      date: formattedSession.date,
      time: formattedSession.time,
      duration: formattedSession.duration
    });

    const updatedSessions = [formattedSession, ...completedSessions];
    setCompletedSessions(updatedSessions);
    localStorage.setItem('droneGuardSessions', JSON.stringify(updatedSessions));
    setSessionName('Untitled Session');
    setGeneratedReport('');
  };

  const handleReportGenerated = (report) => {
    setGeneratedReport(report);
  };

  const handleRenameSession = (sessionId, newName) => {
    const updatedSessions = completedSessions.map(session => 
      session.id === sessionId ? { ...session, name: newName } : session
    );
    setCompletedSessions(updatedSessions);
    localStorage.setItem('droneGuardSessions', JSON.stringify(updatedSessions));
  };

  const handleSaveReportToSession = (sessionId, report) => {
    const updatedSessions = completedSessions.map(session => 
      session.id === sessionId ? { ...session, report: report } : session
    );
    setCompletedSessions(updatedSessions);
    localStorage.setItem('droneGuardSessions', JSON.stringify(updatedSessions));
  };

  const handleDeleteSession = (sessionId) => {
    const updatedSessions = completedSessions.filter(session => session.id !== sessionId);
    setCompletedSessions(updatedSessions);
    localStorage.setItem('droneGuardSessions', JSON.stringify(updatedSessions));
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'overview':
        return (
          <CrowdSafetyDashboard 
            sessionName={sessionName}
            setSessionName={setSessionName}
            onSessionEnd={handleSessionEnd}
          />
        );
      case 'reports':
        return (
          <ReportsPage 
            sessions={completedSessions}
            onRenameReport={handleRenameSession}
            onSaveReport={handleSaveReportToSession}
            onDeleteReport={handleDeleteSession}
          />
        );
      case 'sessions':
        if (selectedSession) {
          return (
            <SessionDetailPage 
              session={selectedSession}
              onBack={handleBackToSessions}
              onReportGenerated={handleReportGenerated}
              onRenameSession={handleRenameSession}
              onSaveReport={handleSaveReportToSession}
            />
          );
        }
        return (
          <DroneSessionsPage 
            sessions={completedSessions}
            onViewSession={handleViewSession}
            onRenameSession={handleRenameSession}
            onDeleteSession={handleDeleteSession}
          />
        );
      default:
        return (
          <CrowdSafetyDashboard 
            sessionName={sessionName}
            setSessionName={setSessionName}
          />
        );
    }
  };

  return (
    <Layout 
      isDarkMode={isDarkMode} 
      toggleTheme={toggleTheme}
      currentPage={currentPage}
      onNavigate={handleNavigate}
    >
      <div style={{ height: 'calc(100vh - 4rem - 2rem)' }}>
        {renderPage()}
      </div>
    </Layout>
  );
}

export default App;
