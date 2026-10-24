import React, { useEffect } from 'react';
import { FloatingReaction } from '../../state/roomReducer';

interface ReactionLayerProps {
  reactions: FloatingReaction[];
  onRemoveReaction: (id: string) => void;
}

export const ReactionLayer: React.FC<ReactionLayerProps> = ({ reactions, onRemoveReaction }) => {
  useEffect(() => {
    if (reactions.length === 0) return;
    const timers = reactions.map((r) =>
      setTimeout(() => {
        onRemoveReaction(r.id);
      }, 2500)
    );
    return () => {
      timers.forEach(clearTimeout);
    };
  }, [reactions, onRemoveReaction]);

  return (
    <div className="reaction-layer" aria-hidden="true">
      {reactions.map((r) => (
        <span
          key={r.id}
          className="floating-reaction"
          style={{
            left: `${Math.round(r.x * 85 + 7)}%`,
          }}
        >
          {r.emoji}
        </span>
      ))}
    </div>
  );
};
