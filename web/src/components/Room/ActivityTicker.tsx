import React from 'react';
import { ActivityLine } from '../../state/roomReducer';

interface ActivityTickerProps {
  lines: ActivityLine[];
}

export const ActivityTicker: React.FC<ActivityTickerProps> = ({ lines }) => {
  if (lines.length === 0) return null;

  return (
    <div className="activity-ticker" role="status" aria-live="polite" aria-atomic="true">
      {lines.map((l) => (
        <div key={l.id} className="activity-line">
          <span>⚡</span>
          <span>{l.text}</span>
        </div>
      ))}
    </div>
  );
};
