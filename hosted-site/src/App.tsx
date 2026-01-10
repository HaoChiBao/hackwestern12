import { useState } from 'react'
import './App.css'
import logo from './assets/logo.png'
import droneBg from './assets/drone_bg.png'

function App() {
  const [activeTab, setActiveTab] = useState('Crowd Monitoring')
  
  const tabs = [
    'Crowd Monitoring',
    'Realtime Risk Analysis',
    'Automatic Alerts',
    'Post Event Report'
  ]

  return (
    <>
      <header className="header">
        <div className="logo-container">
          <img src={logo} alt="Aerotir Logo" className="logo-icon" />
          <span>Aerotir</span>
        </div>
        <nav className="nav">
          <a className="nav-link">Products</a>
          <a className="nav-link">Contact</a>
          <button className="btn-get-started">Get Started</button>
        </nav>
      </header>

      <main>
        <section className="hero" style={{ backgroundImage: `url(${droneBg})` }}>
          <div className="hero-content">
            <h1>
              Realtime Aerial Intelligence<br/>
              For Crowds And Emergency Response
            </h1>
            <p>
              AI drone system that monitors crowd density before congestion becomes
              dangerous helping prevent overcrowding and crowd crush.
            </p>
            <button className="btn-demo">Book a Demo &rarr;</button>
          </div>
        </section>

        <section className="features">
          <h2 className="section-title">Heimdall:</h2>
          <p className="section-desc">
            Our AI drone system that monitors crowd density before congestion becomes
            dangerous helping prevent overcrowding and crowd crush.
          </p>

          <div className="tabs">
            {tabs.map((tab) => (
              <div 
                key={tab} 
                className={`tab ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </div>
            ))}
          </div>

          <div className="dashboard-container">
            <div className="dashboard-preview">
              {/* Using droneBg as placeholder for dashboard since specific dashboard img wasn't found */}
              {/* In a real scenario, this would be the dashboard screenshot */}
              <img src={droneBg} alt="Dashboard Preview" style={{ opacity: 0.8 }} />
            </div>
            <div className="feature-card">
              <h3>Spot Incidents Before They Happen</h3>
              <p>
                AI drone system that monitors crowd density before
                congestion becomes dangerous helping prevent
                overcrowding and crowd crush.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="footer-top">
           <div className="logo-container" style={{ fontSize: '1.5rem' }}>
              <img src={logo} alt="Aerotir Logo" className="logo-icon" style={{ filter: 'invert(1)' }} />
              <span>Aerotir</span>
           </div>
        </div>
        
        {/* Abstract Arrow Graphic (CSS implementation or SVG) */}
        <div style={{ flexGrow: 1, display: 'flex', alignItems: 'flex-end', paddingBottom: '2rem' }}>
            <svg width="200" height="200" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 50 L50 10 L90 50" stroke="white" strokeWidth="15" strokeLinecap="square" />
                <path d="M10 75 L50 35 L90 75" stroke="#ccc" strokeWidth="15" strokeLinecap="square" />
                <path d="M10 100 L50 60 L90 100" stroke="#999" strokeWidth="15" strokeLinecap="square" />
            </svg>
        </div>

        <div className="footer-bottom">
          @ 2025 Aerotir, Inc. All rights reserved.
        </div>
      </footer>
    </>
  )
}

export default App
