import React, { useState } from 'react';
import { QueueItem, parseMediaUrl } from '@contueri/shared';
import { getOrCreateClientId } from '../../hooks/useRoomSocket';

interface QueueProps {
  items: QueueItem[];
  onAdd: (url: string) => void;
  onVote: (itemId: string) => void;
  onRemove: (itemId: string) => void;
  onPlayNext: () => void;
}

export const Queue: React.FC<QueueProps> = ({
  items,
  onAdd,
  onVote,
  onRemove,
  onPlayNext,
}) => {
  const [urlInput, setUrlInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const myClientId = getOrCreateClientId();

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;

    const parsed = parseMediaUrl(urlInput);
    if (!parsed) {
      setError('Invalid media URL format');
      return;
    }

    setError(null);
    onAdd(urlInput.trim());
    setUrlInput('');
  };

  return (
    <div className="sidebar-panel">
      <div className="queue-panel">
        <form onSubmit={handleAdd} className="queue-add-box">
          <input
            type="text"
            value={urlInput}
            onChange={(e) => {
              setUrlInput(e.target.value);
              if (error) setError(null);
            }}
            placeholder="Add video to queue..."
            style={{ flex: 1, fontSize: '0.85rem' }}
          />
          <button type="submit" style={{ fontSize: '0.85rem', padding: '0.4em 0.8em' }}>
            + Add
          </button>
        </form>

        {error && <p style={{ color: 'var(--danger)', fontSize: '0.8rem' }}>{error}</p>}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            {items.length} {items.length === 1 ? 'video' : 'videos'} queued
          </span>
          {items.length > 0 && (
            <button
              type="button"
              className="btn-secondary"
              onClick={onPlayNext}
              style={{ fontSize: '0.75rem', padding: '0.25em 0.6em' }}
            >
              ▶ Play Next Now
            </button>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', overflowY: 'auto', flex: 1 }}>
          {items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
              The queue is empty. Paste a link above to queue up videos for the party!
            </div>
          ) : (
            items.map((item, idx) => {
              const hasVoted = item.voters.includes(myClientId);
              const isMine = item.addedBy === myClientId;

              return (
                <div key={item.id} className="queue-item">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, overflow: 'hidden' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 700 }}>#{idx + 1}</span>
                    <div style={{ overflow: 'hidden' }}>
                      <p style={{ fontSize: '0.85rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.title || item.videoId}
                      </p>
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                        Added by {item.addedByNickname}
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <button
                      type="button"
                      className={`queue-vote-btn ${hasVoted ? 'voted' : ''}`}
                      onClick={() => onVote(item.id)}
                      title={hasVoted ? 'Remove vote' : 'Upvote'}
                      aria-label="Vote for video"
                    >
                      ▲ {item.voters.length}
                    </button>

                    {isMine && (
                      <button
                        type="button"
                        onClick={() => onRemove(item.id)}
                        className="btn-secondary"
                        style={{ padding: '0.2em 0.4em', fontSize: '0.75rem' }}
                        title="Remove from queue"
                        aria-label="Remove video"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
