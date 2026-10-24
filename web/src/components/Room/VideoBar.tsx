import React, { useState } from 'react';
import { parseMediaUrl } from '@contueri/shared';

const SAMPLE_VIDEOS = [
  { label: '🎬 YouTube Demo', url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ' },
  { label: '🍿 Rick Astley', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
  { label: '🎥 Direct MP4 (Oceans)', url: 'https://vjs.zencdn.net/v/oceans.mp4' },
  { label: '🌐 Mini Browser (Wikipedia)', url: 'https://en.m.wikipedia.org/wiki/Special:Random' },
  { label: '📺 Vimeo Embed', url: 'https://player.vimeo.com/video/76979871' },
];

interface VideoBarProps {
  onLoadVideo: (url: string) => void;
}

export const VideoBar: React.FC<VideoBarProps> = ({ onLoadVideo }) => {
  const [videoInput, setVideoInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoInput.trim()) return;

    const parsed = parseMediaUrl(videoInput);
    if (!parsed) {
      setError('Please enter a valid YouTube link, direct video file (.mp4/.webm), or website URL.');
      return;
    }

    setError(null);
    onLoadVideo(videoInput.trim());
    setVideoInput('');
  };

  return (
    <div className="video-bar">
      <form onSubmit={handleSubmit} className="video-bar-form">
        <input
          type="text"
          value={videoInput}
          onChange={(e) => {
            setVideoInput(e.target.value);
            if (error) setError(null);
          }}
          placeholder="Paste YouTube, direct video (.mp4), or embed link..."
          className="video-bar-input"
          aria-label="Media URL input"
        />
        <button type="submit" style={{ whiteSpace: 'nowrap' }}>
          Load Video
        </button>
      </form>

      {error && <div className="video-inline-error">{error}</div>}

      <div className="video-samples">
        <span>Quick try:</span>
        {SAMPLE_VIDEOS.map((sample) => (
          <button
            key={sample.label}
            type="button"
            className="video-sample-chip"
            onClick={() => onLoadVideo(sample.url)}
            title={`Load ${sample.label}`}
          >
            {sample.label}
          </button>
        ))}
      </div>
    </div>
  );
};
