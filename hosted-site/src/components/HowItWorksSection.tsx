import React from 'react'

const steps = [
  {
    step: '1. Ingest live video',
    description: 'Stream drone or CCTV feeds via RTMP and normalize frames for low-latency delivery.',
  },
  {
    step: '2. Run AI/ML analysis',
    description: 'Process frames on GPU to estimate crowd density, flow, and emerging risk hotspots.',
  },
  {
    step: '3. Trigger alerts + report',
    description: 'Notify staff when thresholds are crossed and generate post-event summaries for review.',
  }
]

const HowItWorksSection: React.FC = () => {
  return (
    <section id="how-it-works" className="how-it-works-section">
      <div className="how-it-works-content">
        <div className="how-header">
          <span className="eyebrow">PIPELINE</span>
          <h2 className="section-title">Crowd Watch Workflow</h2>
          <p className="section-desc">
            From live video to real-time risk signals in seconds.
          </p>
        </div>

        <div className="how-grid">
          {steps.map((item, index) => (
            <div key={index} className="how-card">
              <span className="how-label">{item.step}</span>
              <div className="how-image-placeholder">
                  <div className="placeholder-text">Placeholder Image</div>
              </div>
              <p className="how-caption">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default HowItWorksSection
