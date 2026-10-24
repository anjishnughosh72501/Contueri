import React from 'react';
import { VideoPlayer } from '../../VideoPlayer';
import { RoomState, MediaType } from '@contueri/shared';
import { ReadyCheckState } from '@contueri/shared';

interface ScreenProps {
  videoId: string | null;
  mediaType?: MediaType;
  roomState: RoomState | null;
  clockOffset: number;
  hasEnteredParty: boolean;
  readyCheck: ReadyCheckState;
  onEnterParty: () => void;
  onSendPlay: (positionSec: number) => void;
  onSendPause: (positionSec: number) => void;
  onSendSeek: (positionSec: number) => void;
  onVideoEnded?: (videoId: string) => void;
}

export const Screen: React.FC<ScreenProps> = ({
  videoId,
  mediaType,
  roomState,
  clockOffset,
  hasEnteredParty,
  readyCheck,
  onEnterParty,
  onSendPlay,
  onSendPause,
  onSendSeek,
  onVideoEnded,
}) => {
  const isCountdown = readyCheck.phase === 'countdown' && readyCheck.startAt;
  const [countdownRemaining, setCountdownRemaining] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!isCountdown || !readyCheck.startAt) {
      setCountdownRemaining(null);
      return;
    }

    const interval = setInterval(() => {
      const serverNow = Date.now() + clockOffset;
      const msLeft = (readyCheck.startAt || 0) - serverNow;
      const secs = Math.ceil(msLeft / 1000);
      if (secs > 0) {
        setCountdownRemaining(secs);
      } else {
        setCountdownRemaining(null);
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isCountdown, readyCheck.startAt, clockOffset]);

  return (
    <div style={{ position: 'relative' }}>
      <VideoPlayer
        videoId={videoId}
        mediaType={mediaType}
        roomState={roomState}
        clockOffset={clockOffset}
        hasEnteredParty={hasEnteredParty}
        holdUntil={readyCheck.startAt}
        onEnterParty={onEnterParty}
        onSendPlay={onSendPlay}
        onSendPause={onSendPause}
        onSendSeek={onSendSeek}
        onVideoEnded={onVideoEnded}
      />

      {countdownRemaining !== null && (
        <div className="countdown-overlay" aria-live="assertive">
          <div className="countdown-number">{countdownRemaining}</div>
          <p style={{ fontSize: '1.2rem', marginTop: '0.5rem', fontWeight: 600 }}>Starting playback together...</p>
        </div>
      )}
    </div>
  );
};
