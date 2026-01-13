import React from 'react'
import aboutUsImg from '../assets/about-us.png'

const AboutUs: React.FC = () => {
    return (
        <section id="about-us" className="about-us">
            <div className="about-us-container">
                <div className="about-us-image">
                    <img src={aboutUsImg} alt="Aerial view of city streets" />
                </div>
                <div className="about-us-content">
                    <h2 className="section-title">About Us</h2>
                    <p>
                        We’re building real-time crowd intelligence to help venues and event teams spot risk early and respond faster. Our platform combines aerial and fixed-camera views with on-the-fly density and flow analysis, turning video into actionable safety insights.
                    </p>
                    <p>
                        We’re focused on preventing crowd incidents before they happen—without slowing operations down.
                    </p>
                </div>
            </div>
        </section>
    )
}

export default AboutUs
