import React from 'react';
import { Seat } from './Seat';
import { ReactionBar } from './ReactionBar';
import { Member, SEAT_COUNT, EmoteKind, ReadyCheckState } from '@contueri/shared';

interface LoungeProps {
  members: Member[];
  selfId: string | null;
  speechBubbles: Record<string, { text: string; timestamp: number }>;
  readyCheck: ReadyCheckState;
  popcornCount: number;
  onSit: (seat: number) => void;
  onStand: () => void;
  onSendReaction: (emoji: string) => void;
  onSendEmote: (kind: EmoteKind, targetId?: string) => void;
  onSendPopcorn: () => void;
  onStartReadyCheck: () => void;
  onToggleReady: (ready: boolean) => void;
}

export const Lounge: React.FC<LoungeProps> = ({
  members,
  selfId,
  speechBubbles,
  readyCheck,
  popcornCount,
  onSit,
  onStand,
  onSendReaction,
  onSendEmote,
  onSendPopcorn,
  onStartReadyCheck,
  onToggleReady,
}) => {
  // Map seats: seatNumber -> Member
  const seatMap = new Map<number, Member>();
  const standingMembers: Member[] = [];

  // Track duplicate nicknames to disambiguate (e.g. Snorlax-32 #2)
  const nameCounts = new Map<string, number>();
  members.forEach((m) => {
    nameCounts.set(m.nickname, (nameCounts.get(m.nickname) || 0) + 1);
  });
  const nameIndex = new Map<string, number>();

  const getDisambiguatedName = (m: Member): string => {
    const total = nameCounts.get(m.nickname) || 1;
    if (total <= 1) return m.nickname;
    const cur = (nameIndex.get(m.nickname) || 0) + 1;
    nameIndex.set(m.nickname, cur);
    return `${m.nickname} #${cur}`;
  };

  members.forEach((m) => {
    if (m.seat !== null && m.seat >= 0 && m.seat < SEAT_COUNT) {
      seatMap.set(m.seat, m);
    } else {
      standingMembers.push(m);
    }
  });

  const myMember = selfId ? members.find((m) => m.id === selfId) : null;
  const isMySeated = myMember && myMember.seat !== null;
  const isReady = myMember ? myMember.ready : false;

  // 3 rows: Back (0..3), Middle (4..7), Front (8..11)
  const backRow = [0, 1, 2, 3];
  const midRow = [4, 5, 6, 7];
  const frontRow = [8, 9, 10, 11];

  return (
    <div className="lounge-container">
      <div className="lounge-header">
        <ReactionBar onSendReaction={onSendReaction} />

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={onSendPopcorn}
            title="Eat popcorn with friends!"
            aria-label="Eat popcorn"
            style={{ fontSize: '0.85rem', padding: '0.35em 0.75em' }}
          >
            🍿 Eat Popcorn ({popcornCount})
          </button>

          {readyCheck.phase === 'idle' ? (
            <button
              type="button"
              className="btn-secondary"
              onClick={onStartReadyCheck}
              style={{ fontSize: '0.85rem', padding: '0.35em 0.75em' }}
              title="Ask everyone if they are ready"
            >
              ⏱️ Ready Check
            </button>
          ) : readyCheck.phase === 'checking' ? (
            <button
              type="button"
              onClick={() => onToggleReady(!isReady)}
              style={{
                fontSize: '0.85rem',
                padding: '0.35em 0.85em',
                backgroundColor: isReady ? 'var(--success)' : 'var(--warning)',
                color: '#fff',
              }}
            >
              {isReady ? '✓ You are Ready' : "I'm Ready!"}
            </button>
          ) : null}

          {isMySeated && (
            <button
              type="button"
              className="btn-secondary"
              onClick={onStand}
              style={{ fontSize: '0.85rem', padding: '0.35em 0.75em' }}
            >
              Stand Up
            </button>
          )}
        </div>
      </div>

      <div className="seating-rows-wrapper" aria-label="Virtual cinema seating">
        <div className="seating-row seating-row-back">
          {backRow.map((seatNum) => {
            const occupant = seatMap.get(seatNum);
            return (
              <Seat
                key={seatNum}
                seatNumber={seatNum}
                occupant={occupant}
                isMe={!!(occupant && occupant.id === selfId)}
                displayName={occupant ? getDisambiguatedName(occupant) : ''}
                speechText={occupant ? speechBubbles[occupant.id]?.text : undefined}
                onSit={onSit}
                onSendEmote={onSendEmote}
              />
            );
          })}
        </div>

        <div className="seating-row seating-row-middle">
          {midRow.map((seatNum) => {
            const occupant = seatMap.get(seatNum);
            return (
              <Seat
                key={seatNum}
                seatNumber={seatNum}
                occupant={occupant}
                isMe={!!(occupant && occupant.id === selfId)}
                displayName={occupant ? getDisambiguatedName(occupant) : ''}
                speechText={occupant ? speechBubbles[occupant.id]?.text : undefined}
                onSit={onSit}
                onSendEmote={onSendEmote}
              />
            );
          })}
        </div>

        <div className="seating-row seating-row-front">
          {frontRow.map((seatNum) => {
            const occupant = seatMap.get(seatNum);
            return (
              <Seat
                key={seatNum}
                seatNumber={seatNum}
                occupant={occupant}
                isMe={!!(occupant && occupant.id === selfId)}
                displayName={occupant ? getDisambiguatedName(occupant) : ''}
                speechText={occupant ? speechBubbles[occupant.id]?.text : undefined}
                onSit={onSit}
                onSendEmote={onSendEmote}
              />
            );
          })}
        </div>
      </div>

      {standingMembers.length > 0 && (
        <div className="standing-strip" aria-label="Standing room">
          <span className="standing-label">Standing:</span>
          {standingMembers.map((m) => (
            <div
              key={m.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.2rem 0.5rem',
                background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.8rem',
              }}
            >
              <span style={{ fontSize: '1rem' }}>{m.avatar}</span>
              <span style={{ fontWeight: 600 }}>{m.nickname}</span>
              {m.id === selfId && <span style={{ color: 'var(--success)', fontSize: '0.7rem' }}>(You)</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
