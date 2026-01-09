import React from 'react';
import { LayoutDashboard, Video, BarChart2, Settings, Bell, Sun, Moon, Shield, FileText, Database } from 'lucide-react';
import Logo from '../assets/Logo.png';

const SidebarItem = ({ icon: Icon, label, active, onClick }) => (
  <div 
    onClick={onClick}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      padding: '0.5rem 0.75rem',
      borderRadius: 'var(--radius-sm)',
      cursor: 'pointer',
      backgroundColor: active ? 'var(--bg-tertiary)' : 'transparent',
      color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
      marginBottom: '2px',
      border: active ? '1px solid var(--border-color)' : '1px solid transparent',
      fontSize: '0.8rem',
      fontWeight: 500
    }}
  >
    <Icon size={16} />
    <span>{label}</span>
  </div>
);

const Layout = ({ children, isDarkMode, toggleTheme, currentPage, onNavigate }) => {
  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: 'var(--bg-primary)' }}>
      {/* Sidebar */}
      <aside style={{
        width: 'var(--sidebar-width)',
        backgroundColor: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.75rem', 
          padding: '0 1.5rem',
          height: 'var(--header-height)',
          borderBottom: '1px solid var(--border-color)'
        }}>
          <img src={Logo} alt="Aerotir Logo" style={{ height: '32px' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h1 style={{ fontSize: '1.2rem', fontWeight: 400, letterSpacing: '0.02em' }}>Aerotir</h1>
          </div>
        </div>

        <nav style={{ flex: 1, padding: '1rem' }}>
          <div style={{ marginBottom: '1rem' }}>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.5rem', paddingLeft: '0.5rem', textTransform: 'uppercase' }}>Main</p>
            <SidebarItem icon={LayoutDashboard} label="Overview" active={currentPage === 'overview'} onClick={() => onNavigate('overview')} />
            <SidebarItem icon={FileText} label="Reports" active={currentPage === 'reports'} onClick={() => onNavigate('reports')} />
            <SidebarItem icon={Database} label="Drone Sessions" active={currentPage === 'sessions'} onClick={() => onNavigate('sessions')} />
            <SidebarItem icon={Video} label="Live Feeds" />
            <SidebarItem icon={BarChart2} label="Analytics" />
          </div>
          <div>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.5rem', paddingLeft: '0.5rem', textTransform: 'uppercase' }}>System</p>
            <SidebarItem icon={Settings} label="Configuration" />
          </div>
        </nav>

        <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border-color)', padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--success)' }}></div>
            <span>SYSTEM ONLINE</span>
          </div>
          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>v2.4.0-stable</p>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <header style={{
          height: 'var(--header-height)',
          backgroundColor: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 1.5rem'
        }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <h2 style={{ fontSize: '0.9rem', fontWeight: 600, textTransform: 'uppercase' }}>Heimdall: Dashboard</h2>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button className="btn" style={{ padding: '0.25rem 0.5rem' }}>
              <Bell size={16} />
            </button>
            <button 
              className="btn" 
              onClick={toggleTheme}
              style={{ padding: '0.25rem 0.5rem' }}
            >
              {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <div style={{ width: '1px', height: '16px', backgroundColor: 'var(--border-color)' }}></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '24px', height: '24px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700 }}>
                AD
              </div>
              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>ADMIN</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div style={{ flex: 1, padding: '1rem', overflow: 'auto', backgroundColor: 'var(--bg-primary)' }}>
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
