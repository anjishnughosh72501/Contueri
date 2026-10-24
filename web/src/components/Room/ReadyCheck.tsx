import React from 'react';
import { ReadyCheckState, Member } from '@contueri/shared';

interface ReadyCheckProps {
  readyCheck: ReadyCheckState;
  members: Member[];
  selfId: string | null;
  onToggleReady: (ready: boolean) => void;
  onCancel: () => void;
}

export const ReadyCheck: React.FC<ReadyCheckProps> = ({
  readyCheck,
  members,
  selfId,
  onToggleReady,
  onCancel,
}) => {
  if (readyCheck.phase !== 'checking') return null;

  const myMember = selfId ? members.find((m) => m.id === selfId) : null;
  const isReady = myMember ? myMember.ready : false;
  const readyCount = readyCheck.readyIds.length;
  const totalCount = members.length;

  return (
    <div
      style={{
        background: 'rgba(30, 41, 59, 0.95)',
        border: '1px solid var(--accent-primary)',
        borderRadius: 'var(--radius-md)',
        padding: '0.6rem 1rem',
        marginBottom: '0.75rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.5rem',
        boxShadow: 'var(--shadow-md)',
      }}
      role="alert"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ fontSize: '1.2rem' }}>⏱️</span>
        <div>
          <strong style={{ fontSize: '0.85rem' }}>Ready check in progress...</strong>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {readyCount} of {totalCount} members ready
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <button
          type="button"
          onClick={() => onToggleReady(!isReady)}
          style={{
            fontSize: '0.8rem',
            padding: '0.35em 0.85em',
            background: isReady ? 'var(--success)' : 'var(--accent-primary)',
            color: '#fff',
          }}
        >
          {isReady ? '✓ You are Ready' : "I'm Ready!"}
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={onCancel}
          style={{ fontSize: '0.8rem', padding: '0.35em 0.7em' }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};
