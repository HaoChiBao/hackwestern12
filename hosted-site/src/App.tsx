import { useState, useEffect } from 'react'
import './App.css'
import logo from './assets/logo.png'
import droneBg from './assets/drone_bg.png'

function App() {
  const [activeTab, setActiveTab] = useState('Crowd Monitoring')
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      // 100vh check
      if (window.scrollY > window.innerHeight - 100) { // -100 buffer for smoother transition
         setIsScrolled(true)
      } else {
         setIsScrolled(false)
      }
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])
  
  /* Define content for each tab */
  const featuresData: Record<string, { header: string; description: string }> = {
    'Crowd Monitoring': {
      header: 'Spot Incidents Before they Happen',
      description: 'Monitor crowd density and movement in real time from either an aerial drone feed or existing surveillance cameras. CrowdWatch turns live video into an easy-to-read view of where people are clustering, where flow is slowing, and where pressure is building—so teams can act early and keep areas safe.'
    },
    'Realtime Risk Analysis': {
      header: 'Know Where Risk is Building Instantly',
      description: 'CrowdWatch continuously analyzes live crowd patterns to detect rising risk, like bottlenecks, surging density, and unusual movement. Risk levels update moment-by-moment, helping operators prioritize the right zones and intervene before conditions escalate.'
    },
    'Automatic Alerts': {
      header: 'Get Alerted the Moment it Matters',
      description: 'When crowd conditions cross critical thresholds, CrowdWatch automatically sends alerts with location context and what’s changing (density, flow, risk level). Notifications reach the right responders fast, so issues are handled immediately instead of being noticed too late.'
    },
    'Post Event Report': {
      header: 'Learn Fast. Improve Every Event',
      description: 'After the event, CrowdWatch generates a clear report with peak density windows, hotspot locations, and a timeline of key risk moments. Use these insights to improve staffing, barricade placement, entry/exit design, and safety planning for future events.'
    }
  }

  const featureKeys = Object.keys(featuresData)
  const [progress, setProgress] = useState(0)
  const [isInView, setIsInView] = useState(false)

  // Intersection Observer to check if features section is in view
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(entry.isIntersecting)
      },
      { threshold: 0.3 } // Start when 30% visible
    )

    const section = document.querySelector('.features')
    if (section) observer.observe(section)

    return () => {
      if (section) observer.unobserve(section)
    }
  }, [])

  // Auto-switch timer
  useEffect(() => {
    if (!isInView) return

    const intervalTime = 50; // Update every 50ms
    const duration = 8000; // 8 seconds per tab
    const step = 100 / (duration / intervalTime)

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          // Switch to next tab
          const currentIndex = featureKeys.indexOf(activeTab)
          const nextIndex = (currentIndex + 1) % featureKeys.length
          setActiveTab(featureKeys[nextIndex])
          return 0
        }
        return prev + step
      })
    }, intervalTime)

    return () => clearInterval(timer)
  }, [isInView, activeTab, featureKeys]) // Re-run when tab changes to ensure timer stability

  const handleManualTabClick = (tab: string) => {
    setActiveTab(tab)
    setProgress(0) // Reset progress on manual click
  }

  return (
    <>
      <header className={`header ${isScrolled ? 'scrolled' : ''}`}>
        <div 
          className="logo-container" 
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          style={{ cursor: 'pointer' }}
        >
          <img src={logo} alt="Aerotir Logo" className="logo-icon" />
          <span>Aerotir</span>
        </div>
        <nav className="nav">
          <a href="#CrowdWatch" className="nav-link">Products</a>
          <a href="mailto:nathan.wan23@gmail.com" className="nav-link">Contact</a>
          <a 
            href="https://cal.com/james-yang-ukxevk/30min" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="btn-get-started"
          >
            Get Started
          </a>
        </nav>
      </header>

      <main>
        <section className="hero" style={{ backgroundImage: `url(${droneBg})` }}>
          <div className="hero-content">
            <h1>
              Realtime Aerial Intelligence,<br/>
              For Crowds And Emergency Response
            </h1>
            <p>
              AI drone system that monitors crowd density before congestion becomes
              dangerous helping prevent overcrowding and crowd crush.
            </p>
            <a 
              href="https://cal.com/james-yang-ukxevk/30min" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="btn-demo"
            >
              Book a Demo &rarr;
            </a>
          </div>
        </section>

        <section id="CrowdWatch" className="features">
          <h2 className="section-title">CrowdWatch:</h2>
          <p className="section-desc">
            Our AI drone system that monitors crowd density before congestion becomes
            dangerous helping prevent overcrowding and crowd crush.
          </p>

          <div className="tabs">
            {featureKeys.map((tab) => (
              <div 
                key={tab} 
                className={`tab ${activeTab === tab ? 'active' : ''}`}
                onClick={() => handleManualTabClick(tab)}
              >
                {tab}
                {activeTab === tab && (
                  <div className="progress-bar-container">
                    <div 
                      className="progress-bar" 
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="dashboard-container">
            <div className="dashboard-preview">
              <iframe 
                width="100%" 
                height="100%" 
                src="https://www.youtube.com/embed/sdX6YAMYKGA" 
                title="CrowdWatch" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                referrerPolicy="strict-origin-when-cross-origin" 
                allowFullScreen
              ></iframe>
            </div>
            <div className="feature-card" key={activeTab}> {/* key triggers animation reset */}
              <div className="fade-in">
                <h3>{featuresData[activeTab].header}</h3>
                <p>{featuresData[activeTab].description}</p>
              </div>
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
           
           <div className="footer-links">
             <div className="footer-column">
               <h4>Product</h4>
               <a href="#CrowdWatch">Features</a>
               <a href="#">Security</a>
               <a href="#">Enterprise</a>
             </div>
             <div className="footer-column">
               <h4>Company</h4>
               <a href="#">About Us</a>
               <a href="#">Careers</a>
               <a href="#">Contact</a>
             </div>
             <div className="footer-column">
               <h4>Resources</h4>
               <a href="#">Blog</a>
               <a href="#">Documentation</a>
               <a href="#">Status</a>
             </div>
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
