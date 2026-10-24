import React, { useEffect, useRef, useState, useCallback } from 'react';
import { MediaType, RoomState } from '@contueri/shared';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface VideoPlayerProps {
  videoId: string | null;
  mediaType?: MediaType;
  roomState: RoomState | null;
  clockOffset: number;
  hasEnteredParty: boolean;
  holdUntil?: number;
  onEnterParty: () => void;
  onSendPlay: (positionSec: number) => void;
  onSendPause: (positionSec: number) => void;
  onSendSeek: (positionSec: number) => void;
  onVideoEnded?: (videoId: string) => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoId,
  mediaType = 'youtube',
  roomState,
  clockOffset,
  hasEnteredParty,
  holdUntil,
  onEnterParty,
  onSendPlay,
  onSendPause,
  onSendSeek,
  onVideoEnded,
}) => {
  const ytPlayerRef = useRef<any>(null);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const browserIframeRef = useRef<HTMLIFrameElement | null>(null);
  const [isYtApiReady, setIsYtApiReady] = useState<boolean>(() => !!window.YT && !!window.YT.Player);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [useProxyForDirect, setUseProxyForDirect] = useState<boolean>(false);
  const [browserReloadKey, setBrowserReloadKey] = useState<number>(0);
  const [streamEmbedMode, setStreamEmbedMode] = useState<boolean>(false);

  // Sync state refs
  const applyingRemoteRef = useRef<boolean>(false);
  const lastPolledTimeRef = useRef<number>(0);
  const roomStateRef = useRef<RoomState | null>(roomState);
  roomStateRef.current = roomState;

  const clockOffsetRef = useRef<number>(clockOffset);
  clockOffsetRef.current = clockOffset;

  // Clear player error & reset proxy fallback on video change
  useEffect(() => {
    setPlayerError(null);
    setUseProxyForDirect(false);
    const hasMovieId = videoId && /\/movie\/(\d+)/i.test(videoId);
    setStreamEmbedMode(!!hasMovieId);
  }, [videoId]);

  // Compute expected playback position based on server time and clock offset
  const getExpectedPosition = useCallback((): number => {
    if (!roomStateRef.current) return 0;
    const { positionSec, isPlaying, updatedAt } = roomStateRef.current;
    if (!isPlaying) return positionSec;
    const serverNow = Date.now() + clockOffsetRef.current;
    const elapsedSec = (serverNow - updatedAt) / 1000;
    return positionSec + Math.max(0, elapsedSec);
  }, []);

  // Helper to get current player time regardless of mediaType
  const getCurrentPlayerTime = useCallback((): number => {
    if (mediaType === 'youtube' && ytPlayerRef.current) {
      if (typeof ytPlayerRef.current.getCurrentTime === 'function') {
        return ytPlayerRef.current.getCurrentTime() || 0;
      }
    } else if (mediaType === 'direct' && videoElementRef.current) {
      return videoElementRef.current.currentTime || 0;
    }
    return 0;
  }, [mediaType]);

  // Set remote applying flag safely with timeout
  const setApplyingRemote = useCallback((durationMs = 600) => {
    applyingRemoteRef.current = true;
    setTimeout(() => {
      applyingRemoteRef.current = false;
    }, durationMs);
  }, []);

  // Load YouTube IFrame API script once
  useEffect(() => {
    if (window.YT && window.YT.Player) {
      setIsYtApiReady(true);
      return;
    }

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

    const prevOnReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (prevOnReady) prevOnReady();
      setIsYtApiReady(true);
    };
  }, []);

  // 1. Seek detection: Poll player every 500ms
  useEffect(() => {
    if (!hasEnteredParty || !videoId || (mediaType !== 'youtube' && mediaType !== 'direct')) return;

    const interval = setInterval(() => {
      if (applyingRemoteRef.current) {
        lastPolledTimeRef.current = getCurrentPlayerTime();
        return;
      }

      const curTime = getCurrentPlayerTime();
      const lastTime = lastPolledTimeRef.current;
      const expectedTime = getExpectedPosition();
      const delta = curTime - lastTime;

      // In 500ms, normal playback moves forward by ~0.5s.
      // A jump of > 1.5s not caused by normal playback indicates a user seek!
      if (Math.abs(delta) > 1.5 && Math.abs(curTime - expectedTime) > 1.5) {
        onSendSeek(curTime);
      }

      lastPolledTimeRef.current = curTime;
    }, 500);

    return () => clearInterval(interval);
  }, [hasEnteredParty, videoId, mediaType, getCurrentPlayerTime, getExpectedPosition, onSendSeek]);

  // 2. Drift correction: every 5 seconds, if isPlaying and |player - expected| > 1.5s, seekTo expected
  useEffect(() => {
    if (!hasEnteredParty || !videoId || (mediaType !== 'youtube' && mediaType !== 'direct')) return;

    const interval = setInterval(() => {
      if (applyingRemoteRef.current || !roomStateRef.current?.isPlaying) return;

      const curTime = getCurrentPlayerTime();
      const expected = getExpectedPosition();
      const drift = Math.abs(curTime - expected);

      if (drift > 1.5) {
        setApplyingRemote(600);
        if (mediaType === 'youtube' && ytPlayerRef.current) {
          if (typeof ytPlayerRef.current.seekTo === 'function') {
            ytPlayerRef.current.seekTo(expected, true);
          }
        } else if (mediaType === 'direct' && videoElementRef.current) {
          if (videoElementRef.current.readyState >= 1) {
            videoElementRef.current.currentTime = expected;
          }
        }
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [hasEnteredParty, videoId, mediaType, getCurrentPlayerTime, getExpectedPosition, setApplyingRemote]);

  // 3. Apply remote state changes when roomState updates
  useEffect(() => {
    if (!hasEnteredParty || !roomState || !videoId) return;

    const expected = getExpectedPosition();
    const curTime = getCurrentPlayerTime();
    const drift = Math.abs(curTime - expected);

    setApplyingRemote(600);

    const serverNow = Date.now() + clockOffset;
    const shouldHold = holdUntil && serverNow < holdUntil;

    if (shouldHold) {
      const waitMs = Math.max(0, holdUntil - serverNow);
      setTimeout(() => {
        if (roomStateRef.current?.isPlaying) {
          if (mediaType === 'youtube' && ytPlayerRef.current?.playVideo) {
            ytPlayerRef.current.playVideo();
          } else if (mediaType === 'direct' && videoElementRef.current?.paused) {
            videoElementRef.current.play().catch(() => {});
          }
        }
      }, waitMs);
      return;
    }

    if (mediaType === 'youtube' && ytPlayerRef.current) {
      if (typeof ytPlayerRef.current.seekTo === 'function') {
        if (drift > 1.5) {
          ytPlayerRef.current.seekTo(expected, true);
        }
        if (roomState.isPlaying) {
          ytPlayerRef.current.playVideo();
        } else {
          ytPlayerRef.current.pauseVideo();
        }
      }
    } else if (mediaType === 'direct' && videoElementRef.current) {
      const vid = videoElementRef.current;
      if (vid.readyState >= 1) {
        if (drift > 1.5) {
          vid.currentTime = expected;
        }
        if (roomState.isPlaying && vid.paused) {
          vid.play().catch(() => {});
        } else if (!roomState.isPlaying && !vid.paused) {
          vid.pause();
        }
      } else {
        const onLoaded = () => {
          vid.currentTime = expected;
          if (roomStateRef.current?.isPlaying) {
            vid.play().catch(() => {});
          }
          vid.removeEventListener('loadedmetadata', onLoaded);
        };
        vid.addEventListener('loadedmetadata', onLoaded);
      }
    }
  }, [roomState, hasEnteredParty, videoId, mediaType, getCurrentPlayerTime, getExpectedPosition, setApplyingRemote]);

  // Initialize or update YouTube player
  useEffect(() => {
    if (mediaType !== 'youtube' || !videoId || !isYtApiReady || !hasEnteredParty) {
      return;
    }

    const containerId = 'yt-player-target';

    if (!ytPlayerRef.current) {
      if (!document.getElementById(containerId)) return;

      ytPlayerRef.current = new window.YT.Player(containerId, {
        videoId: videoId,
        playerVars: {
          autoplay: 0,
          controls: 1,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          enablejsapi: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            const expected = getExpectedPosition();
            setApplyingRemote(700);
            if (expected > 0) {
              ytPlayerRef.current.seekTo(expected, true);
            }
            if (roomStateRef.current?.isPlaying) {
              ytPlayerRef.current.playVideo();
            }
          },
          onStateChange: (event: any) => {
            if (applyingRemoteRef.current) {
              return;
            }

            const state = event.data;
            const curTime = ytPlayerRef.current.getCurrentTime() || 0;

            if (state === window.YT.PlayerState.PLAYING) {
              if (!roomStateRef.current?.isPlaying) {
                onSendPlay(curTime);
              }
            } else if (state === window.YT.PlayerState.PAUSED) {
              if (roomStateRef.current?.isPlaying) {
                onSendPause(curTime);
              }
            } else if (state === window.YT.PlayerState.ENDED) {
              if (videoId) onVideoEnded?.(videoId);
            }
          },
          onError: (event: any) => {
            const errCode = event?.data;
            if (errCode === 101 || errCode === 150) {
              setPlayerError(
                'The copyright owner (e.g. Formula 1, NFL, Sony Music) has blocked this video from playing on external websites. Please pick a video that allows embedding (like trailers, tutorials, or music videos).'
              );
            } else if (errCode === 100) {
              setPlayerError('This video was not found, or has been removed/made private.');
            } else if (errCode === 2) {
              setPlayerError('Invalid YouTube video parameter or ID.');
            } else {
              setPlayerError(`Playback error (${errCode}). Please try another video.`);
            }
          },
        },
      });
    } else {
      try {
        if (typeof ytPlayerRef.current.getVideoData === 'function') {
          const currentData = ytPlayerRef.current.getVideoData();
          if (currentData && currentData.video_id !== videoId) {
            setApplyingRemote(700);
            ytPlayerRef.current.cueVideoById(videoId);
          }
        } else if (typeof ytPlayerRef.current.cueVideoById === 'function') {
          setApplyingRemote(700);
          ytPlayerRef.current.cueVideoById(videoId);
        }
      } catch (e) {
        console.error('Error updating YouTube video:', e);
      }
    }
  }, [mediaType, videoId, isYtApiReady, hasEnteredParty, getExpectedPosition, setApplyingRemote, onSendPlay, onSendPause]);

  // Clean up YT player on unmount or when changing to non-youtube
  useEffect(() => {
    return () => {
      if (ytPlayerRef.current && typeof ytPlayerRef.current.destroy === 'function') {
        try {
          ytPlayerRef.current.destroy();
        } catch {
          // Ignore
        }
        ytPlayerRef.current = null;
      }
    };
  }, [mediaType]);

  // Direct video event handlers
  const handleDirectPlay = () => {
    if (applyingRemoteRef.current) return;
    const cur = videoElementRef.current?.currentTime || 0;
    if (!roomStateRef.current?.isPlaying) {
      onSendPlay(cur);
    }
  };

  const handleDirectPause = () => {
    if (applyingRemoteRef.current) return;
    const cur = videoElementRef.current?.currentTime || 0;
    if (roomStateRef.current?.isPlaying) {
      onSendPause(cur);
    }
  };

  const handleDirectSeeked = () => {
    if (applyingRemoteRef.current) return;
    const cur = videoElementRef.current?.currentTime || 0;
    onSendSeek(cur);
  };

  const handleDirectLoadedMetadata = () => {
    const expected = getExpectedPosition();
    if (videoElementRef.current) {
      if (expected > 0) {
        videoElementRef.current.currentTime = expected;
      }
      if (roomStateRef.current?.isPlaying) {
        videoElementRef.current.play().catch(() => {});
      }
    }
  };

  const handleDirectVideoError = () => {
    // If direct fetch fails (e.g. CORS or Range issues), try routing through worker proxy
    if (!useProxyForDirect && videoId) {
      console.log('[VideoPlayer] Direct video failed, attempting worker proxy fallback...');
      setUseProxyForDirect(true);
    } else {
      setPlayerError(
        'Could not load direct video file. Please ensure the URL is accessible and allows streaming.'
      );
    }
  };

  const workerBase = (
    import.meta.env.VITE_WORKER_URL ||
    (typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? 'http://127.0.0.1:8787'
      : '')
  ).replace(/\/$/, '');

  const effectiveDirectSrc = useProxyForDirect && videoId
    ? `${workerBase}/api/proxy?url=${encodeURIComponent(videoId)}`
    : videoId || '';

  const proxyBrowserUrl = videoId ? `${workerBase}/api/proxy?url=${encodeURIComponent(videoId)}` : '';

  const tmdbMovieIdMatch = videoId ? videoId.match(/\/movie\/(\d+)/i) : null;
  const tmdbMovieId = tmdbMovieIdMatch ? tmdbMovieIdMatch[1] : null;

  return (
    <div className="theater-screen-wrapper">
      <div className="screen-display">
        <div className="screen-glow" />

        {/* Audio / Autoplay Unlock Overlay */}
        {!hasEnteredParty && (
          <div className="audio-unlock-overlay">
            <span style={{ fontSize: '3.5rem', marginBottom: '0.75rem' }}>🍿</span>
            <h3 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.5rem', color: '#ffffff' }}>
              Click to Enter Contueri
            </h3>
            <p style={{ color: '#94a3b8', maxWidth: '420px', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
              Browsers require user interaction to allow synchronized video playback and audio.
            </p>
            <button
              onClick={onEnterParty}
              style={{
                fontSize: '1.1rem',
                padding: '0.75em 1.75em',
                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                boxShadow: '0 4px 20px rgba(99, 102, 241, 0.4)',
              }}
            >
              🎬 Join Party & Start Screen
            </button>
          </div>
        )}

        {/* Embedded Video Restricted / Error Banner */}
        {playerError && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(11, 15, 25, 0.95)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1.5rem',
              textAlign: 'center',
              zIndex: 15,
            }}
          >
            <span style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🚫</span>
            <h4 style={{ color: '#f87171', fontSize: '1.15rem', marginBottom: '0.5rem', fontWeight: 700 }}>
              Video Cannot Be Played Here
            </h4>
            <p style={{ color: '#cbd5e1', fontSize: '0.9rem', maxWidth: '460px', marginBottom: '1.25rem', lineHeight: 1.4 }}>
              {playerError}
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <button onClick={() => setPlayerError(null)} className="btn-secondary" style={{ fontSize: '0.85rem' }}>
                Dismiss
              </button>
              {videoId && (
                <a
                  href={mediaType === 'youtube' ? `https://www.youtube.com/watch?v=${videoId}` : videoId}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: '0.5em 1.1em',
                    background: '#6366f1',
                    color: '#fff',
                    borderRadius: '8px',
                    textDecoration: 'none',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                  }}
                >
                  Open in New Tab ↗
                </a>
              )}
            </div>
          </div>
        )}

        {/* Screen Content */}
        {!videoId ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
            <span style={{ fontSize: '3rem', display: 'block', marginBottom: '0.75rem' }}>📽️</span>
            <h4 style={{ color: '#cbd5e1', fontSize: '1.15rem', marginBottom: '0.5rem' }}>
              The Screen is Ready
            </h4>
            <p style={{ fontSize: '0.9rem', maxWidth: '380px', margin: '0 auto' }}>
              Paste a YouTube link, direct video (.mp4), or any website URL to browse and watch together!
            </p>
          </div>
        ) : mediaType === 'youtube' ? (
          <div className="player-wrapper">
            <div id="yt-player-target" style={{ width: '100%', height: '100%' }} />
          </div>
        ) : mediaType === 'direct' ? (
          <div className="player-wrapper">
            <video
              ref={videoElementRef}
              src={effectiveDirectSrc}
              controls
              playsInline
              className="player-element"
              style={{ background: '#000', objectFit: 'contain' }}
              onPlay={handleDirectPlay}
              onPause={handleDirectPause}
              onSeeked={handleDirectSeeked}
              onLoadedMetadata={handleDirectLoadedMetadata}
              onError={handleDirectVideoError}
              onEnded={() => { if (videoId) onVideoEnded?.(videoId); }}
            />
          </div>
        ) : mediaType === 'browser' ? (
          /* Mini Browser for any online link */
          <div className="mini-browser-container">
            <div className="mini-browser-toolbar">
              <button
                type="button"
                className="mini-browser-btn"
                onClick={() => setBrowserReloadKey((k) => k + 1)}
                title="Reload Page"
              >
                ↻ Reload
              </button>
              {tmdbMovieId && (
                <button
                  type="button"
                  className="mini-browser-btn"
                  style={{
                    backgroundColor: streamEmbedMode ? '#4f46e5' : '#1e293b',
                    borderColor: '#6366f1',
                    color: '#fff',
                    fontWeight: 700,
                  }}
                  onClick={() => setStreamEmbedMode((prev) => !prev)}
                  title="Switch between Direct Stream Player and Website View"
                >
                  {streamEmbedMode ? '🌐 View Website' : '🎬 Direct Stream Player'}
                </button>
              )}
              <div className="mini-browser-url-bar" title={videoId || ''}>
                <span>🔒</span>
                <span>{streamEmbedMode && tmdbMovieId ? `Embed: 2embed.cc/embed/${tmdbMovieId}` : videoId}</span>
              </div>
              <a
                href={videoId || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="mini-browser-btn"
                style={{ textDecoration: 'none' }}
                title="Open in real browser tab"
              >
                Open ↗
              </a>
            </div>
            {!streamEmbedMode && tmdbMovieId && (
              <div
                style={{
                  background: 'rgba(99, 102, 241, 0.15)',
                  borderBottom: '1px solid rgba(99, 102, 241, 0.3)',
                  padding: '0.4rem 0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.5rem',
                  fontSize: '0.8rem',
                  color: '#c7d2fe',
                }}
              >
                <span>💡 This catalog website uses client-side bot checks. Click Stream Player for instant playback:</span>
                <button
                  type="button"
                  onClick={() => setStreamEmbedMode(true)}
                  style={{
                    padding: '0.2rem 0.65rem',
                    fontSize: '0.75rem',
                    background: '#6366f1',
                    color: '#fff',
                    flexShrink: 0,
                  }}
                >
                  ▶ Open Stream Player
                </button>
              </div>
            )}
            <iframe
              key={`${browserReloadKey}-${streamEmbedMode}`}
              ref={browserIframeRef}
              src={streamEmbedMode && tmdbMovieId ? `https://2embed.cc/embed/${tmdbMovieId}` : proxyBrowserUrl}
              title="Mini Browser View"
              className="mini-browser-iframe"
              allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
            />
          </div>
        ) : (
          /* Generic Iframe / Embed */
          <div className="player-wrapper">
            <iframe
              src={videoId}
              title="Online Embed Player"
              className="player-element"
              allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
              onError={() =>
                setPlayerError(
                  'This online link refuses to be displayed directly in an iframe. Switch to mini browser mode to proxy.'
                )
              }
            />
          </div>
        )}
      </div>
    </div>
  );
};
