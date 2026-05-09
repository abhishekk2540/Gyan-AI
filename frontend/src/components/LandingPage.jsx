import React, { useState, useEffect, useRef } from 'react';
import TypingText from './TypingText';
import anime from 'animejs';

export default function LandingPage({ onGetStarted }) {
  const [openFaq, setOpenFaq] = useState(null);
  const bannerRef = useRef(null);

  useEffect(() => {
    // Initial State
    anime.set('.float-box', { translateX: -500, opacity: 0 });
    anime.set('.robot-container', { translateY: 400 });

    const timeline = anime.timeline({
      easing: 'easeOutExpo',
      duration: 1000
    });

    timeline
      .add({
        targets: '.robot-container',
        translateY: 0,
        duration: 1500,
        delay: 500
      })
      .add({
        targets: '.robot-hand',
        rotate: [0, -30, 0],
        translateY: [0, -10, 0],
        duration: 600,
        easing: 'easeInOutQuad'
      })
      .add({
        targets: '.float-box',
        translateX: 0,
        opacity: 1,
        delay: anime.stagger(200),
        duration: 1200,
        offset: '-=400' // Start while hand is moving
      });
  }, []);

  const features = [
    { icon: '💬', title: 'Smart Chat', desc: 'Engage with powerful LLMs for coding, creative writing, and brainstorming.' },
    { icon: '📚', title: 'Ask My Docs', desc: 'Upload PDFs and documents to get instant answers using RAG technology.' },
    { icon: '🤖', title: 'AI Agent', desc: 'Autonomous agent that can search the web and perform complex reasoning tasks.' },
    { icon: '👁️', title: 'Vision Intelligence', desc: 'Real-time object detection and image analysis using your webcam.' },
    { icon: '🎨', title: 'Poster Maker', desc: 'Generate stunning high-quality posters from simple text prompts.' },
  ];

  const faqs = [
    { q: "What is Gyan AI?", a: "Gyan AI is an all-in-one multimodal AI platform designed for productivity and intelligence." },
    { q: "Is my data private?", a: "Yes, Gyan AI prioritizes your privacy by using secure cloud integrations with industry-standard encryption." },
    { q: "How does 'Ask My Docs' work?", a: "It uses Retrieval-Augmented Generation (RAG) to scan your documents and find precise answers based only on your data." }
  ];

  return (
    <div className="landing-page">
      {/* Navbar */}
      <nav className="landing-nav">
        <div className="landing-logo">
          <img src="/logo.png" alt="Gyan AI" />
          <span>Gyan AI</span>
        </div>
        <button className="btn-primary" onClick={onGetStarted}>Get Started</button>
      </nav>

      {/* Hero Section */}
      <header className="hero">
        <div className="hero-main">
          <div className="hero-content">
            <div className="badge">Next-Gen Multimodal OS</div>
            <TypingText 
              text="Experience the future of intelligence with Gyan AI." 
              className="hero-title"
              speed={50}
            />
            <p className="hero-subtitle">
              One platform for Chat, RAG, Agents, and Vision. Built for developers, creators, and students.
            </p>
          </div>
          
          {/* Animated Hero Banner */}
          <div className="hero-banner">
            <div className="robot-container">
              <div className="robot-head">🧠</div>
              <div className="robot-body">🤖</div>
              <div className="robot-hand">🦾</div>
            </div>
            <div className="floating-features">
              <div className="float-box chat">💬 Chat</div>
              <div className="float-box rag">📚 RAG</div>
              <div className="float-box agent">🤖 Agent</div>
              <div className="float-box vision">👁️ Vision</div>
              <div className="float-box poster">🎨 Poster</div>
            </div>
          </div>
        </div>
      </header>

      {/* Features Section */}
      <section className="features-section">
        <h2 className="section-title">Powerful Features</h2>
        <div className="features-grid">
          {features.map((f, i) => (
            <div key={i} className="feature-card">
              <div className="feature-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ Section */}
      <section className="faq-section">
        <h2 className="section-title">Common Questions</h2>
        <div className="faq-list">
          {faqs.map((f, i) => (
            <div key={i} className={`faq-item ${openFaq === i ? 'open' : ''}`} onClick={() => setOpenFaq(openFaq === i ? null : i)}>
              <div className="faq-question">
                {f.q}
                <span>{openFaq === i ? '−' : '+'}</span>
              </div>
              {openFaq === i && <div className="faq-answer">{f.a}</div>}
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <img src="/logo.png" alt="Gyan AI" />
            <h3>Gyan AI</h3>
          </div>
          <p>© 2024 Gyan AI OS. All rights reserved.</p>
          <div className="footer-links">
            <a href="#">Privacy</a>
            <a href="#">Terms</a>
            <a href="#">Github</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
