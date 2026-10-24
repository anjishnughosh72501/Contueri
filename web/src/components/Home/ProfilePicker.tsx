import React from 'react';
import {
  AVATAR_EMOJIS,
  AVATAR_COLORS,
  generatePokemonNickname,
} from '@contueri/shared';

interface ProfilePickerProps {
  nickname: string;
  avatar: string;
  color: string;
  onChangeNickname: (val: string) => void;
  onChangeAvatar: (val: string) => void;
  onChangeColor: (val: string) => void;
  onSurpriseMe: () => void;
}

export const ProfilePicker: React.FC<ProfilePickerProps> = ({
  nickname,
  avatar,
  color,
  onChangeNickname,
  onChangeAvatar,
  onChangeColor,
  onSurpriseMe,
}) => {
  const handleRollPokemon = () => {
    onChangeNickname(generatePokemonNickname());
  };

  return (
    <div className="profile-picker-card">
      <div className="avatar-preview-row">
        <div className="avatar-preview-badge" style={{ backgroundColor: color }}>
          {avatar}
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <label htmlFor="nickname-input" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            Your Nickname
          </label>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <input
              id="nickname-input"
              type="text"
              value={nickname}
              onChange={(e) => onChangeNickname(e.target.value)}
              placeholder="Enter nickname..."
              maxLength={20}
              style={{ flex: 1 }}
            />
            <button
              type="button"
              onClick={handleRollPokemon}
              className="btn-secondary"
              title="Generate a random Pokémon name"
              aria-label="Roll random Pokémon nickname"
              style={{ padding: '0.4em 0.7em', fontSize: '0.8rem' }}
            >
              🎲 Pokémon
            </button>
            <button
              type="button"
              onClick={onSurpriseMe}
              className="btn-secondary"
              title="Surprise me with a random look & name"
              aria-label="Surprise me with random profile"
              style={{ padding: '0.4em 0.7em', fontSize: '0.8rem' }}
            >
              ✨ Surprise
            </button>
          </div>
        </div>
      </div>

      <div>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
          Choose Avatar
        </span>
        <div className="avatar-grid" role="radiogroup" aria-label="Avatar options">
          {AVATAR_EMOJIS.map((em) => (
            <button
              key={em}
              type="button"
              className={`avatar-choice-btn ${avatar === em ? 'selected' : ''}`}
              onClick={() => onChangeAvatar(em)}
              aria-label={`Select avatar ${em}`}
              aria-checked={avatar === em}
              role="radio"
            >
              {em}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
          Choose Color
        </span>
        <div className="color-row" role="radiogroup" aria-label="Color options">
          {AVATAR_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={`color-dot-btn ${color === c ? 'selected' : ''}`}
              style={{ backgroundColor: c }}
              onClick={() => onChangeColor(c)}
              aria-label={`Select color ${c}`}
              aria-checked={color === c}
              role="radio"
            />
          ))}
        </div>
      </div>
    </div>
  );
};
