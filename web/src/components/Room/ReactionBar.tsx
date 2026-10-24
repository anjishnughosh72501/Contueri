import React, { useEffect, useRef } from 'react';
import { REACTION_EMOJIS } from '@contueri/shared';

interface ReactionBarProps {
  onSendReaction: (emoji: string) => void;
}

export const ReactionBar: React.FC<ReactionBarProps> = ({ onSendReaction }) => {
  const lastSentTimeRef = useRef<number>(0);

  const handleSend = (emoji: string) => {
    const now = Date.now();
    if (now - lastSentTimeRef.current < 250) {
      return; // Client throttle ~4 per second
    }
    lastSentTimeRef.current = now;
    onSendReaction(emoji);
  };

  // Keyboard shortcuts 1-8
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input, textarea, or contentEditable
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      const keyNum = parseInt(e.key, 10);
      if (keyNum >= 1 && keyNum <= REACTION_EMOJIS.length) {
        e.preventDefault();
        handleSend(REACTION_EMOJIS[keyNum - 1]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="reaction-bar" role="toolbar" aria-label="Quick reactions">
      {REACTION_EMOJIS.map((emoji, idx) => (
        <button
          key={emoji}
          type="button"
          className="reaction-btn"
          onClick={() => handleSend(emoji)}
          title={`React with ${emoji} (key ${idx + 1})`}
          aria-label={`Reaction ${emoji}`}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
};
