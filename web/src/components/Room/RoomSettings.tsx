import React, { useState } from 'react';
import { THEMES, Theme, MAX_ROOM_NAME_LENGTH } from '@contueri/shared';

interface RoomSettingsProps {
  currentName: string;
  currentTheme: Theme;
  currentVoiceUrl: string | null;
  onSave: (name: string, theme: Theme, voiceUrl: string | null) => void;
  onClose: () => void;
}

export const RoomSettings: React.FC<RoomSettingsProps> = ({
  currentName,
  currentTheme,
  currentVoiceUrl,
  onSave,
  onClose,
}) => {
  const [name, setName] = useState(currentName);
  const [theme, setTheme] = useState<Theme>(currentTheme);
  const [voiceUrl, setVoiceUrl] = useState(currentVoiceUrl || '');
  const [error, setError] = useState<string | null>(null);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim().slice(0, MAX_ROOM_NAME_LENGTH) || 'Hangout Lounge';
    let trimmedVoice: string | null = voiceUrl.trim();
    if (trimmedVoice) {
      if (!trimmedVoice.startsWith('https://')) {
        setError('Voice link must start with https://');
        return;
      }
    } else {
      trimmedVoice = null;
    }

    onSave(trimmedName, theme, trimmedVoice);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Room Settings"
    >
      <div
        className="home-card"
        style={{ width: '100%', maxWidth: '440px', gap: '1.25rem' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>⚙️ Lounge Settings</h3>
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            style={{ padding: '0.2em 0.5em', fontSize: '0.8rem' }}
            aria-label="Close settings"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>
              Lounge Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={MAX_ROOM_NAME_LENGTH}
              style={{ width: '100%' }}
              placeholder="Hangout Lounge"
            />
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>
              Lounge Atmosphere / Theme
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
              {THEMES.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`btn-secondary ${theme === t ? 'selected' : ''}`}
                  onClick={() => setTheme(t)}
                  style={{
                    padding: '0.5em',
                    fontSize: '0.85rem',
                    borderColor: theme === t ? 'var(--accent-primary)' : 'var(--border-strong)',
                    background: theme === t ? 'rgba(99, 102, 241, 0.2)' : 'var(--bg-secondary)',
                  }}
                >
                  {t === 'cinema' && '🎬 Cinema'}
                  {t === 'living-room' && '🛋️ Living Room'}
                  {t === 'campfire' && '🔥 Campfire'}
                  {t === 'rooftop' && '🌃 Rooftop'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>
              Voice Lounge Link (Optional Jitsi / Discord / etc.)
            </label>
            <input
              type="url"
              value={voiceUrl}
              onChange={(e) => {
                setVoiceUrl(e.target.value);
                if (error) setError(null);
              }}
              placeholder="https://meet.jit.si/contueri-..."
              style={{ width: '100%', fontSize: '0.85rem' }}
            />
            {error && <span style={{ color: 'var(--danger)', fontSize: '0.75rem' }}>{error}</span>}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit">
              Save Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
