import React, { useState } from 'react';
import { ProfilePicker } from './Home/ProfilePicker';
import {
  AVATAR_EMOJIS,
  AVATAR_COLORS,
  generatePokemonNickname,
} from '@contueri/shared';

interface JoinPromptProps {
  roomCode: string;
  onConfirmJoin: (nickname: string, avatar: string, color: string) => void;
  onCancel: () => void;
}

export const JoinPrompt: React.FC<JoinPromptProps> = ({
  roomCode,
  onConfirmJoin,
  onCancel,
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
    const finalNick = nickname.trim() || generatePokemonNickname();
    onConfirmJoin(finalNick, avatar, color);
  };

  return (
    <div className="home-container">
      <div className="home-card">
        <div style={{ textAlign: 'center' }}>
          <span style={{ fontSize: '3rem', display: 'block', marginBottom: '0.5rem' }}>🍿</span>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800 }}>Join Lounge {roomCode}</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Choose how you appear to your friends before entering.
          </p>
        </div>

        <ProfilePicker
          nickname={nickname}
          avatar={avatar}
          color={color}
          onChangeNickname={handleNicknameChange}
          onChangeAvatar={handleAvatarChange}
          onChangeColor={handleColorChange}
          onSurpriseMe={handleSurpriseMe}
        />

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
          <button
            type="button"
            onClick={onCancel}
            className="btn-secondary"
            style={{ flex: 1, padding: '0.75em' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleJoin}
            style={{ flex: 2, padding: '0.75em' }}
          >
            🎬 Enter Lounge
          </button>
        </div>
      </div>
    </div>
  );
};
