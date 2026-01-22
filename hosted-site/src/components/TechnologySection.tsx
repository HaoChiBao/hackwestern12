import React from 'react'

const primaryCards = [
  {
    title: 'RTMP Video Ingest',
    description: 'Ingest live drone or CCTV feeds via RTMP and normalize streams for low-latency processing and playback.',
    badge: 'LIVE' // Optional badge based on request
  },
  {
    title: 'LiveKit Real-Time Delivery',
    description: 'WebRTC delivery with LiveKit for interactive playback, multi-view switching, and scalable real-time distribution.'
  }
]

const secondaryCards = [
  {
    title: 'AWS GPU Inference',
    description: 'Burst to on-demand GPU instances for high-throughput inference when load spikes, keeping costs predictable.'
  },
  {
    title: 'AI/ML Crowd Analytics',
    description: 'Run crowd density, flow, and risk scoring per frame to surface hotspots and early warning signals.'
  },
  {
    title: 'Streaming Pipeline',
    description: 'Frame sampling, buffering, and backpressure controls to balance latency vs. accuracy across devices.'
  },
  {
    title: 'Event Logging & Post-Event Reports',
    description: 'Store alerts and telemetry to generate summaries and timelines for incident review and planning.'
  }
]

const features = [
  { title: 'Latency Optimized', desc: 'Prioritize end-to-end responsiveness for live decision making.' },
  { title: 'Multi-View Support', desc: 'Switch between drone and fixed cameras without losing context.' },
  { title: 'Alert Engine', desc: 'Threshold + anomaly triggers for proactive notifications.' },
  { title: 'Scalable Architecture', desc: 'Designed to scale from small venues to large festivals.' }
]

const TechnologySection: React.FC = () => {
  return (
    <section id="technology" className="technology-section">
      <div className="technology-content">
        <div className="tech-header">
          <span className="eyebrow">INFRASTRUCTURE</span>
          <h2 className="section-title">Technology</h2>
          <p className="section-desc">
            Real-time video + on-the-fly AI to turn aerial and fixed-camera feeds into actionable crowd safety signals.
          </p>
        </div>

        <div className="tech-grid-primary">
          {primaryCards.map((card, index) => (
            <div key={index} className="feature-card tech-card">
              {card.badge && <span className="tech-badge">{card.badge}</span>}
              <h3>{card.title}</h3>
              <p>{card.description}</p>
            </div>
          ))}
        </div>

        <div className="tech-grid-secondary">
          {secondaryCards.map((card, index) => (
            <div key={index} className="feature-card tech-card secondary">
              <h3>{card.title}</h3>
              <p>{card.description}</p>
            </div>
          ))}
        </div>

        <div className="tech-features-list">
          {features.map((feature, index) => (
            <div key={index} className="tech-feature-item">
              <h4>{feature.title}</h4>
              <p>{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default TechnologySection
