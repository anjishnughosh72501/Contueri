import React from 'react';
import { Member, EmoteKind, EMOTES } from '@contueri/shared';

interface PeopleProps {
  members: Member[];
  selfId: string | null;
  onSendEmote: (kind: EmoteKind, targetId?: string) => void;
}

export const People: React.FC<PeopleProps> = ({ members, selfId, onSendEmote }) => {
  return (
    <div className="sidebar-panel">
      <div className="people-list">
        {members.map((m) => {
          const isMe = m.id === selfId;

          return (
            <div key={m.id} className="people-item">
              <div className="people-info">
                <div className="people-avatar" style={{ backgroundColor: m.color }}>
                  {m.avatar}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{m.nickname}</span>
                    {isMe && <span style={{ color: 'var(--success)', fontSize: '0.7rem' }}>(You)</span>}
                    {m.ready && <span style={{ color: 'var(--success)', fontSize: '0.75rem' }} title="Ready!">✓</span>}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {m.seat !== null ? `Seat ${m.seat + 1}` : 'Standing'}
                  </span>
                </div>
              </div>

              {!isMe && (
                <div style={{ display: 'flex', gap: '0.2rem' }}>
                  {EMOTES.map((em) => (
                    <button
                      key={em}
                      type="button"
                      className="btn-secondary"
                      style={{ padding: '0.2em 0.4em', fontSize: '0.75rem' }}
                      onClick={() => onSendEmote(em, m.id)}
                      title={`Send ${em} to ${m.nickname}`}
                      aria-label={`Send ${em} to ${m.nickname}`}
                    >
                      {em === 'wave' && '👋'}
                      {em === 'popcorn' && '🍿'}
                      {em === 'highfive' && '✋'}
                      {em === 'dance' && '💃'}
                      {em === 'shush' && '🤫'}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
