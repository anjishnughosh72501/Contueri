import React from 'react';

interface HeaderProps {
  roomCode?: string;
  roomName?: string;
  voiceUrl?: string | null;
  connectionStatus?: 'disconnected' | 'connecting' | 'connected';
  focusMode?: boolean;
  onToggleFocusMode?: () => void;
  onOpenSettings?: () => void;
  onCopyInvite?: () => void;
  onShareQr?: () => void;
  onLeaveRoom?: () => void;
  onNavigateHome: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  roomCode,
  roomName,
  voiceUrl,
  connectionStatus,
  focusMode,
  onToggleFocusMode,
  onOpenSettings,
  onCopyInvite,
  onShareQr,
  onLeaveRoom,
  onNavigateHome,
}) => {
  const defaultVoiceUrl = roomCode ? `https://meet.jit.si/contueri-${roomCode}` : '#';
  const effectiveVoiceUrl = voiceUrl || defaultVoiceUrl;

  return (
    <header className="app-header">
      <div className="app-brand" onClick={onNavigateHome} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onNavigateHome()}>
        <span style={{ fontSize: '1.5rem' }}>🍿</span>
        <span>Contueri</span>
        {roomName && (
          <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 500, marginLeft: '0.4rem' }}>
            • {roomName}
          </span>
        )}
      </div>

      {roomCode && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Room:</span>
            <strong style={{ letterSpacing: '1px', color: 'var(--accent-primary)', fontSize: '1.05rem' }}>
              {roomCode}
            </strong>
          </div>

          <a
            href={effectiveVoiceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary"
            style={{ textDecoration: 'none', fontSize: '0.82rem', padding: '0.35em 0.7em' }}
            title="Open voice lounge in a new tab"
          >
            🎧 Join Voice
          </a>

          {onToggleFocusMode && (
            <button
              onClick={onToggleFocusMode}
              className="btn-secondary"
              style={{ fontSize: '0.82rem', padding: '0.35em 0.7em' }}
              title={focusMode ? 'Exit Focus Mode (Esc)' : 'Dim the lights / Focus Mode'}
              aria-label="Toggle focus mode"
            >
              {focusMode ? '💡 Lights On' : '🌙 Dim Lights'}
            </button>
          )}

          {onCopyInvite && (
            <button
              onClick={onCopyInvite}
              className="btn-secondary"
              style={{ fontSize: '0.82rem', padding: '0.35em 0.7em' }}
              aria-label="Copy invitation link"
            >
              📋 Copy
            </button>
          )}

          {onShareQr && (
            <button
              onClick={onShareQr}
              className="btn-secondary"
              style={{ fontSize: '0.82rem', padding: '0.35em 0.7em' }}
              aria-label="Show room QR code"
              title="Show QR Code"
            >
              📱 QR
            </button>
          )}

          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="btn-secondary"
              style={{ fontSize: '0.82rem', padding: '0.35em 0.6em' }}
              aria-label="Open room settings"
              title="Room Settings & Theme"
            >
              ⚙️
            </button>
          )}

          {connectionStatus && (
            <span className={`badge badge-${connectionStatus}`}>
              {connectionStatus === 'connected' && '● Connected'}
              {connectionStatus === 'connecting' && '○ Connecting'}
              {connectionStatus === 'disconnected' && '✕ Offline'}
            </span>
          )}

          {onLeaveRoom && (
            <button
              onClick={onLeaveRoom}
              className="btn-danger"
              style={{ fontSize: '0.82rem', padding: '0.35em 0.7em' }}
              aria-label="Leave room"
            >
              Leave
            </button>
          )}
        </div>
      )}
    </header>
  );
};
