import React, { useState, useEffect } from 'react';
import { LandingHero } from './LandingHero';
import { ProfilePicker } from './ProfilePicker';
import { CodeBoxes } from './CodeBoxes';
import { RecentRooms, RecentRoom } from './RecentRooms';
import {
  AVATAR_EMOJIS,
  AVATAR_COLORS,
  generatePokemonNickname,
  isValidRoomCode,
} from '@contueri/shared';

interface HomeViewProps {
  onJoinRoom: (code: string) => void;
  onCreateRoom: () => void;
  isCreating: boolean;
  createError: string | null;
}

export const HomeView: React.FC<HomeViewProps> = ({
  onJoinRoom,
  onCreateRoom,
  isCreating,
  createError,
}) => {
  const [nickname, setNickname] = useState<string>(() => {
    return localStorage.getItem('ct_nickname') || generatePokemonNickname();
  });

  const [avatar, setAvatar] = useState<string>(() => {
    return localStorage.getItem('ct_avatar') || '🍿';
  });

  const [color, setColor] = useState<string>(() => {
    return localStorage.getItem('ct_color') || '#6366f1';
  });

  const [code, setCode] = useState<string>('');
  const [recentRooms, setRecentRooms] = useState<RecentRoom[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('ct_recent_rooms');
      if (stored) {
        setRecentRooms(JSON.parse(stored));
      }
    } catch {}
  }, []);

  const handleNicknameChange = (val: string) => {
    setNickname(val);
    localStorage.setItem('ct_nickname', val);
  };

  const handleAvatarChange = (val: string) => {
    setAvatar(val);
    localStorage.setItem('ct_avatar', val);
  };

  const handleColorChange = (val: string) => {
    setColor(val);
    localStorage.setItem('ct_color', val);
  };

  const handleSurpriseMe = () => {
    const newName = generatePokemonNickname();
    const newAvatar = AVATAR_EMOJIS[Math.floor(Math.random() * AVATAR_EMOJIS.length)];
    const newColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
    handleNicknameChange(newName);
    handleAvatarChange(newAvatar);
    handleColorChange(newColor);
  };

  const handleJoin = () => {
    if (isValidRoomCode(code)) {
      onJoinRoom(code);
    }
  };

  return (
    <div className="home-container">
      <div className="home-card">
        <LandingHero />

        <ProfilePicker
          nickname={nickname}
          avatar={avatar}
          color={color}
          onChangeNickname={handleNicknameChange}
          onChangeAvatar={handleAvatarChange}
          onChangeColor={handleColorChange}
          onSurpriseMe={handleSurpriseMe}
        />

        <div className="home-section" style={{ alignItems: 'center' }}>
          <button
            type="button"
            onClick={onCreateRoom}
            disabled={isCreating}
            style={{ width: '100%', padding: '0.8em', fontSize: '1.05rem' }}
          >
            {isCreating ? 'Creating Lounge...' : '✨ Create a New Lounge'}
          </button>
          {createError && (
            <p style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>{createError}</p>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
          <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
            or enter room code
          </span>
          <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
        </div>

        <div className="home-section" style={{ alignItems: 'center' }}>
          <CodeBoxes value={code} onChange={setCode} onSubmit={handleJoin} />
          <button
            type="button"
            onClick={handleJoin}
            disabled={!isValidRoomCode(code)}
            className="btn-secondary"
            style={{ width: '100%', padding: '0.65em' }}
          >
            🚪 Join Lounge
          </button>
        </div>

        <RecentRooms rooms={recentRooms} onSelectRoom={onJoinRoom} />
      </div>
    </div>
  );
};
