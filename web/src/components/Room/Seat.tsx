import React, { useState } from 'react';
import { Member, EmoteKind, EMOTES } from '@contueri/shared';

interface SeatProps {
  seatNumber: number;
  occupant?: Member;
  isMe: boolean;
  displayName: string;
  speechText?: string;
  onSit: (seat: number) => void;
  onSendEmote: (kind: EmoteKind, targetId?: string) => void;
}

export const Seat: React.FC<SeatProps> = ({
  seatNumber,
  occupant,
  isMe,
  displayName,
  speechText,
  onSit,
  onSendEmote,
}) => {
  const [showEmoteMenu, setShowEmoteMenu] = useState(false);

  if (!occupant) {
    return (
      <button
        type="button"
        className="theater-seat empty"
        onClick={() => onSit(seatNumber)}
        aria-label={`Sit in seat ${seatNumber + 1}`}
        title={`Click to sit in seat ${seatNumber + 1}`}
      >
        <div className="seat-chair-back" />
        <span style={{ fontSize: '1.2rem', opacity: 0.5 }}>🪑</span>
        <span>Seat {seatNumber + 1}</span>
      </button>
    );
  }

  const handleSeatClick = () => {
    if (!isMe) {
      setShowEmoteMenu((prev) => !prev);
    }
  };

  const handleEmoteClick = (kind: EmoteKind, e: React.MouseEvent) => {
    e.stopPropagation();
    onSendEmote(kind, occupant.id);
    setShowEmoteMenu(false);
  };

  return (
    <div
      className={`theater-seat occupied ${isMe ? 'is-me' : ''}`}
      onClick={handleSeatClick}
      role={isMe ? 'status' : 'button'}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          handleSeatClick();
        }
      }}
      aria-label={isMe ? `Your seat: ${displayName}` : `Seat occupied by ${displayName}`}
      title={isMe ? 'This is your seat' : `Click to send an emote to ${displayName}`}
    >
      <div className="seat-chair-back" />

      {speechText && (
        <div className="seat-speech-bubble" role="tooltip">
          {speechText}
        </div>
      )}

      {showEmoteMenu && !isMe && (
        <div className="seat-emote-menu" role="menu" aria-label="Quick emotes">
          {EMOTES.map((em) => (
            <button
              key={em}
              type="button"
              className="seat-emote-btn"
              onClick={(e) => handleEmoteClick(em, e)}
              title={em}
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

      {occupant.ready && (
        <div className="seat-ready-indicator" title="Ready!">
          ✓
        </div>
      )}

      <div className="seat-avatar-wrapper" style={{ backgroundColor: occupant.color }}>
        {occupant.avatar}
      </div>

      <span className="seat-name">{displayName}</span>

      {isMe && (
        <span style={{ fontSize: '0.65rem', color: 'var(--success)', fontWeight: 800 }}>
          YOU
        </span>
      )}
    </div>
  );
};
