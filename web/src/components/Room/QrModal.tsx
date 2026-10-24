import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface QrModalProps {
  url: string;
  roomCode: string;
  onClose: () => void;
}

export const QrModal: React.FC<QrModalProps> = ({ url, roomCode, onClose }) => {
  const [dataUrl, setDataUrl] = useState<string>('');

  useEffect(() => {
    QRCode.toDataURL(url, { width: 220, margin: 2, color: { dark: '#000000', light: '#ffffff' } })
      .then(setDataUrl)
      .catch(console.error);
  }, [url]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 110,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Room QR Code"
    >
      <div className="home-card" style={{ maxWidth: '360px', alignItems: 'center', textAlign: 'center', gap: '1rem' }}>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>📱 Scan to Join {roomCode}</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Point a phone camera to quickly enter this hangout lounge.
        </p>

        {dataUrl ? (
          <img
            src={dataUrl}
            alt={`QR code to join room ${roomCode}`}
            style={{ borderRadius: 'var(--radius-md)', border: '4px solid #ffffff' }}
          />
        ) : (
          <div style={{ width: '220px', height: '220px', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            Generating...
          </div>
        )}

        <button type="button" className="btn-secondary" onClick={onClose} style={{ width: '100%' }}>
          Done
        </button>
      </div>
    </div>
  );
};
