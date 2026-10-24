import React from 'react';

export const LandingHero: React.FC = () => {
  return (
    <div className="home-hero">
      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '2.5rem', animation: 'bounce 2s infinite ease-in-out' }}>🍿</span>
        <span style={{ fontSize: '2.5rem', animation: 'bounce 2s infinite ease-in-out 0.3s' }}>🛋️</span>
        <span style={{ fontSize: '2.5rem', animation: 'bounce 2s infinite ease-in-out 0.6s' }}>✨</span>
      </div>
      <h1 className="home-title">Virtual Hangout Lounge</h1>
      <p className="home-subtitle">
        Watch videos in sync, browse the web together, react, and hang out with friends in real-time.
      </p>
    </div>
  );
};
