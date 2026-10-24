import React from 'react';

export interface RecentRoom {
  code: string;
  name: string;
  lastVisited: number;
}

interface RecentRoomsProps {
  rooms: RecentRoom[];
  onSelectRoom: (code: string) => void;
  onClearRooms?: () => void;
}

export const RecentRooms: React.FC<RecentRoomsProps> = ({ rooms, onSelectRoom }) => {
  if (rooms.length === 0) return null;

  return (
    <div className="home-section">
      <span className="home-section-title">Recent Lounges</span>
      <div className="recent-rooms-grid">
        {rooms.map((r) => (
          <button
            key={r.code}
            type="button"
            className="recent-room-chip"
            onClick={() => onSelectRoom(r.code)}
            title={`Rejoin room ${r.code}`}
          >
            <span className="recent-room-code">{r.code}</span>
            <span className="recent-room-name">{r.name || 'Hangout Lounge'}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
