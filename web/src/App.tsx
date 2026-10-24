import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ClientMessage,
  ServerMessage,
  ChatMessage,
  RoomState,
  MIN_NICKNAME_LENGTH,
  MAX_NICKNAME_LENGTH,
  MAX_CHAT_TEXT_LENGTH,
  isValidRoomCode,
  sanitizeRoomCode,
  generatePokemonNickname,
  parseMediaUrl,
} from '@contueri/shared';
import { VideoPlayer } from './VideoPlayer';

const AVATAR_ICONS = ['🍿', '🥤', '🎬', '🍕', '🎧', '🍦', '🍩', '🍫', '✨', '🦊', '🐼', '🚀'];

const WORKER_HTTP_BASE = (import.meta.env.VITE_WORKER_URL || '').replace(/\/$/, '');

const SAMPLE_VIDEOS = [
  { label: '🎬 YouTube Demo', url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ' },
  { label: '🍿 Rick Astley', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
  { label: '🎥 Direct MP4 (Oceans)', url: 'https://vjs.zencdn.net/v/oceans.mp4' },
  { label: '🌐 Mini Browser (Wikipedia)', url: 'https://en.m.wikipedia.org/wiki/Special:Random' },
  { label: '📺 Vimeo Embed', url: 'https://player.vimeo.com/video/76979871' },
];

function getAvatarForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_ICONS[Math.abs(hash) % AVATAR_ICONS.length];
}

export default function App() {
  // Navigation / URL state
  const [, setCurrentPath] = useState<string>(window.location.pathname);
  const [roomCode, setRoomCode] = useState<string>('');

  // Nickname state (defaults to a random Pokemon if not set)
  const [nickname, setNickname] = useState<string>(() => {
    const saved = localStorage.getItem('wp_nickname');
    if (saved && saved.trim()) return saved.trim();
    const auto = generatePokemonNickname();
    localStorage.setItem('wp_nickname', auto);
    return auto;
  });
  const [nicknameInput, setNicknameInput] = useState<string>(nickname);
  const [joinCodeInput, setJoinCodeInput] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Room state
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'reconnecting'>('disconnected');
  const [members, setMembers] = useState<string[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'chat' | 'members' | 'lounge'>('chat');

  // Video and Party State
  const [hasEnteredParty, setHasEnteredParty] = useState<boolean>(false);
  const [videoUrlInput, setVideoUrlInput] = useState<string>('');
  const [videoInputError, setVideoInputError] = useState<string | null>(null);

  // Chat state
  const [chatInput, setChatInput] = useState<string>('');
  const [rateLimitWarning, setRateLimitWarning] = useState<string | null>(null);
  const chatMessagesEndRef = useRef<HTMLDivElement | null>(null);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const isAutoScrollEnabledRef = useRef<boolean>(true);

  // WebSocket references
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef<number>(0);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const shouldReconnectRef = useRef<boolean>(true);

  // Sync route from window.location (spaces are completely stripped)
  const updateRoute = useCallback(() => {
    const path = window.location.pathname;
    setCurrentPath(path);
    const match = path.match(/^\/r\/([^/]+)$/);
    if (match) {
      setRoomCode(sanitizeRoomCode(decodeURIComponent(match[1])));
    } else {
      setRoomCode('');
    }
  }, []);

  useEffect(() => {
    updateRoute();
    const handlePopState = () => updateRoute();
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [updateRoute]);

  const navigateTo = (path: string) => {
    window.history.pushState({}, '', path);
    updateRoute();
  };

  const showToast = (text: string) => {
    setToastMessage(text);
    setTimeout(() => {
      setToastMessage((cur) => (cur === text ? null : cur));
    }, 3000);
  };

  // Roll a new random Pokemon name
  const handleRollPokemon = () => {
    const auto = generatePokemonNickname();
    setNicknameInput(auto);
    setNickname(auto);
    localStorage.setItem('wp_nickname', auto);
    showToast(`🎲 Selected Pokémon: ${auto}`);
  };

  // Auto-scroll chat unless user has scrolled up
  useEffect(() => {
    if (isAutoScrollEnabledRef.current && chatMessagesEndRef.current) {
      chatMessagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeTab]);

  const handleChatScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    isAutoScrollEnabledRef.current = scrollHeight - scrollTop - clientHeight < 60;
  };

  // Create room handler
  const handleCreateRoom = async () => {
    setErrorMessage(null);
    if (!nickname) {
      const auto = generatePokemonNickname();
      setNickname(auto);
      setNicknameInput(auto);
      localStorage.setItem('wp_nickname', auto);
    }
    try {
      const res = await fetch(`${WORKER_HTTP_BASE}/api/rooms`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      navigateTo(`/r/${data.code}`);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to create room');
    }
  };

  // Join room by code (strips spaces completely)
  const handleJoinByCode = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = sanitizeRoomCode(joinCodeInput);
    if (!isValidRoomCode(cleanCode)) {
      setErrorMessage('Please enter a valid 6-character room code.');
      return;
    }
    if (!nickname) {
      const auto = generatePokemonNickname();
      setNickname(auto);
      setNicknameInput(auto);
      localStorage.setItem('wp_nickname', auto);
    }
    setErrorMessage(null);
    navigateTo(`/r/${cleanCode}`);
  };

  // Save nickname (generates Pokemon if left empty)
  const handleSaveNickname = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    let clean = nicknameInput.trim();
    if (!clean) {
      clean = generatePokemonNickname();
      setNicknameInput(clean);
    } else if (clean.length < MIN_NICKNAME_LENGTH || clean.length > MAX_NICKNAME_LENGTH) {
      setErrorMessage(`Nickname must be between ${MIN_NICKNAME_LENGTH} and ${MAX_NICKNAME_LENGTH} characters.`);
      return;
    }
    setNickname(clean);
    localStorage.setItem('wp_nickname', clean);
    setErrorMessage(null);
  };

  // Set video for room
  const handleSetVideo = (urlToSet?: string) => {
    const raw = (urlToSet !== undefined ? urlToSet : videoUrlInput).trim();
    if (!raw) {
      setVideoInputError('Please enter a video URL.');
      return;
    }

    const parsed = parseMediaUrl(raw);
    if (!parsed) {
      setVideoInputError('Invalid video link. Paste a YouTube URL (watch, shorts, youtu.be), direct video file (.mp4), or embed link.');
      return;
    }

    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      setVideoInputError('WebSocket is not connected.');
      return;
    }

    setVideoInputError(null);
    const msg: ClientMessage = {
      type: 'setVideo',
      videoId: raw,
      mediaType: parsed.mediaType,
    };
    socketRef.current.send(JSON.stringify(msg));
    setVideoUrlInput('');
    setHasEnteredParty(true); // Automatically unlock if user set video
    showToast('🎬 Loading video for the room...');
  };

  // Clock Offset & Sync State
  const [clockOffset, setClockOffset] = useState<number>(0);
  const pingSentTimeRef = useRef<number>(0);

  const sendPing = useCallback(() => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      pingSentTimeRef.current = Date.now();
      socketRef.current.send(JSON.stringify({ type: 'ping' }));
    }
  }, []);

  const handleSendPlay = useCallback((positionSec: number) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'play', positionSec }));
    }
  }, []);

  const handleSendPause = useCallback((positionSec: number) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'pause', positionSec }));
    }
  }, []);

  const handleSendSeek = useCallback((positionSec: number) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'seek', positionSec }));
    }
  }, []);

  // WebSocket Connection Management
  const connectWebSocket = useCallback((targetCode: string, currentNick: string) => {
    if (!targetCode || !currentNick) return;

    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }

    setConnectionStatus(reconnectAttemptRef.current > 0 ? 'reconnecting' : 'connecting');

    let wsUrl: string;
    if (WORKER_HTTP_BASE) {
      const wsBase = WORKER_HTTP_BASE.replace(/^http/, 'ws');
      wsUrl = `${wsBase}/api/rooms/${targetCode}/ws`;
    } else {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = `${protocol}//${window.location.host}/api/rooms/${targetCode}/ws`;
    }

    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      setConnectionStatus('connected');
      reconnectAttemptRef.current = 0;
      // Send join message
      const joinMsg: ClientMessage = { type: 'join', nickname: currentNick };
      ws.send(JSON.stringify(joinMsg));
      // Ping immediately to calculate clock offset
      pingSentTimeRef.current = Date.now();
      ws.send(JSON.stringify({ type: 'ping' }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as ServerMessage;
        switch (msg.type) {
          case 'pong': {
            const rtt = Date.now() - pingSentTimeRef.current;
            const offset = msg.serverTime + rtt / 2 - Date.now();
            setClockOffset(offset);
            break;
          }
          case 'state':
            setRoomState({
              videoId: msg.videoId,
              mediaType: msg.mediaType,
              isPlaying: msg.isPlaying,
              positionSec: msg.positionSec,
              updatedAt: msg.updatedAt,
            });
            break;
          case 'members':
            setMembers(msg.nicknames);
            break;
          case 'history':
            setMessages(msg.messages);
            break;
          case 'chat':
            setMessages((prev) => [
              ...prev,
              {
                id: crypto.randomUUID(),
                nickname: msg.nickname,
                text: msg.text,
                time: msg.time,
                isSystem: msg.isSystem,
              },
            ]);
            break;
          case 'error':
            if (msg.message.toLowerCase().includes('fast') || msg.message.toLowerCase().includes('rate')) {
              setRateLimitWarning(msg.message);
              setTimeout(() => setRateLimitWarning(null), 4000);
            } else {
              setErrorMessage(msg.message);
            }
            break;
        }
      } catch (err) {
        console.error('Error parsing server message:', err);
      }
    };

    ws.onclose = (event) => {
      setConnectionStatus('disconnected');
      if (shouldReconnectRef.current && event.code !== 4404 && event.code !== 1008) {
        const backoffMs = Math.min(1000 * Math.pow(2, reconnectAttemptRef.current), 10000);
        reconnectAttemptRef.current += 1;
        setConnectionStatus('reconnecting');
        reconnectTimeoutRef.current = window.setTimeout(() => {
          connectWebSocket(targetCode, currentNick);
        }, backoffMs);
      }
    };

    ws.onerror = () => {
      setConnectionStatus('disconnected');
    };
  }, []);

  // Connect when in a room and nickname is set
  useEffect(() => {
    let pingInterval: number | null = null;
    if (roomCode && nickname) {
      shouldReconnectRef.current = true;
      connectWebSocket(roomCode, nickname);
      // Refresh clock offset every 30 seconds
      pingInterval = window.setInterval(() => {
        sendPing();
      }, 30000);
    } else {
      if (socketRef.current) {
        shouldReconnectRef.current = false;
        socketRef.current.close();
        socketRef.current = null;
      }
      setMembers([]);
      setMessages([]);
      setConnectionStatus('disconnected');
    }

    return () => {
      shouldReconnectRef.current = false;
      if (pingInterval) {
        clearInterval(pingInterval);
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [roomCode, nickname, connectWebSocket, sendPing]);

  // Send Chat message
  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      return;
    }
    const text = chatInput.trim();
    if (!text) return;

    if (text.length > MAX_CHAT_TEXT_LENGTH) {
      setRateLimitWarning(`Message is too long (max ${MAX_CHAT_TEXT_LENGTH} chars)`);
      return;
    }

    const chatMsg: ClientMessage = { type: 'chat', text };
    socketRef.current.send(JSON.stringify(chatMsg));
    setChatInput('');
    isAutoScrollEnabledRef.current = true;
  };

  // Copy invite link
  const handleCopyInvite = () => {
    const inviteUrl = `${window.location.origin}/r/${roomCode}`;
    navigator.clipboard.writeText(inviteUrl);
    showToast('🎉 Invite link copied to clipboard!');
  };

  // Leave room
  const handleLeaveRoom = () => {
    navigateTo('/');
  };

  // Seating slots calculation (total 12 seats)
  const TOTAL_SEATS = 12;
  const seats = Array.from({ length: TOTAL_SEATS }).map((_, index) => {
    const memberName = members[index];
    if (memberName) {
      return {
        occupied: true,
        nickname: memberName,
        isMe: memberName.toLowerCase() === nickname.toLowerCase(),
        avatar: getAvatarForName(memberName),
      };
    }
    return {
      occupied: false,
      nickname: null,
      isMe: false,
      avatar: '🪑',
    };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* App Header */}
      <header className="app-header">
        <div className="app-brand" onClick={() => navigateTo('/')}>
          <span style={{ fontSize: '1.5rem' }}>🍿</span>
          <span>Contueri</span>
        </div>

        {roomCode && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Room:</span>
              <strong style={{ letterSpacing: '1px', color: '#6366f1', fontSize: '1.1rem' }}>
                {roomCode}
              </strong>
            </div>

            <button onClick={handleCopyInvite} className="btn-secondary" style={{ padding: '0.4em 0.8em' }}>
              📋 Copy Link
            </button>

            <span className={`badge badge-${connectionStatus}`}>
              ● {connectionStatus}
            </span>

            <button onClick={handleLeaveRoom} className="btn-danger" style={{ padding: '0.4em 0.8em', fontSize: '0.85rem' }}>
              Leave
            </button>
          </div>
        )}
      </header>

      {/* Main View Router */}
      {!roomCode ? (
        /* HOME VIEW */
        <main className="home-container">
          <div className="home-card">
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <h1 style={{ fontSize: '2.2rem', marginBottom: '0.5rem', fontWeight: 800 }}>
                Watch Together in Sync
              </h1>
              <p style={{ color: '#94a3b8', fontSize: '1.1rem' }}>
                Join a room, take a seat, and watch synchronized YouTube & online video embeds with friends.
              </p>
            </div>

            {errorMessage && (
              <div style={{ padding: '0.75rem', marginBottom: '1.5rem', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', borderRadius: '8px', color: '#fca5a5' }}>
                {errorMessage}
              </div>
            )}

            {/* Set Nickname First */}
            <div style={{ marginBottom: '2rem', paddingBottom: '1.5rem', borderBottom: '1px solid #334155' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label style={{ fontWeight: 600, color: '#cbd5e1' }}>
                  Your Nickname
                </label>
                <button
                  type="button"
                  onClick={handleRollPokemon}
                  className="btn-secondary"
                  style={{ fontSize: '0.8rem', padding: '0.25em 0.6em' }}
                >
                  🎲 Roll Pokémon
                </button>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <input
                  type="text"
                  placeholder="e.g. Alex (leave blank for Pokémon)"
                  value={nicknameInput}
                  maxLength={MAX_NICKNAME_LENGTH}
                  onChange={(e) => setNicknameInput(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button onClick={() => handleSaveNickname()} className="btn-secondary">
                  Save
                </button>
              </div>
              {nickname && (
                <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span>✓</span> Nickname: <strong>{nickname}</strong>
                </div>
              )}
            </div>

            {/* Actions: Create or Join */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <button
                onClick={handleCreateRoom}
                style={{ width: '100%', padding: '0.85em', fontSize: '1.1rem' }}
              >
                ✨ Create New Party Room
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ flex: 1, height: '1px', backgroundColor: '#334155' }} />
                <span style={{ color: '#64748b', fontSize: '0.85rem' }}>OR JOIN EXISTING</span>
                <div style={{ flex: 1, height: '1px', backgroundColor: '#334155' }} />
              </div>

              <form onSubmit={handleJoinByCode} style={{ display: 'flex', gap: '0.75rem' }}>
                <input
                  type="text"
                  placeholder="6-character room code"
                  value={joinCodeInput}
                  maxLength={6}
                  onChange={(e) => setJoinCodeInput(sanitizeRoomCode(e.target.value))}
                  onKeyDown={(e) => {
                    if (e.key === ' ') e.preventDefault();
                  }}
                  style={{ flex: 1, letterSpacing: '2px', fontWeight: 700 }}
                />
                <button type="submit" className="btn-secondary" disabled={sanitizeRoomCode(joinCodeInput).length !== 6}>
                  Join Room
                </button>
              </form>
            </div>
          </div>
        </main>
      ) : !nickname ? (
        /* NICKNAME PROMPT BEFORE SEATING */
        <main className="home-container">
          <div className="home-card" style={{ textAlign: 'center' }}>
            <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>🍿</span>
            <h2 style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>Join Party {roomCode}</h2>
            <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>
              Pick a nickname so friends know who is sitting with them, or roll a random Pokémon!
            </p>

            {errorMessage && (
              <div style={{ padding: '0.75rem', marginBottom: '1.5rem', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', borderRadius: '8px', color: '#fca5a5' }}>
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleSaveNickname} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  placeholder="e.g. Snorlax (or leave blank)"
                  value={nicknameInput}
                  maxLength={MAX_NICKNAME_LENGTH}
                  onChange={(e) => setNicknameInput(e.target.value)}
                  autoFocus
                  style={{ textAlign: 'center', fontSize: '1.1rem', flex: 1 }}
                />
                <button
                  type="button"
                  onClick={handleRollPokemon}
                  className="btn-secondary"
                  title="Roll random Pokémon"
                >
                  🎲 Roll
                </button>
              </div>
              <button type="submit" style={{ padding: '0.8em', fontSize: '1.05rem' }}>
                Take a Seat & Join
              </button>
            </form>
          </div>
        </main>
      ) : (
        /* ACTIVE ROOM VIEW (THEATER + SEATS + CHAT) */
        <div className="room-container">
          {/* Main Stage: Theater Screen & Seating Lounge */}
          <section className="main-stage">
            {/* Video Link Input Bar */}
            <div className="video-bar">
              <form
                className="video-bar-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSetVideo();
                }}
              >
                <input
                  type="text"
                  className="video-bar-input"
                  placeholder="Paste YouTube, direct video (.mp4), or embed link..."
                  value={videoUrlInput}
                  onChange={(e) => {
                    setVideoUrlInput(e.target.value);
                    if (videoInputError) setVideoInputError(null);
                  }}
                />
                <button type="submit">
                  Load Video
                </button>
              </form>

              {videoInputError && (
                <div className="video-inline-error">
                  ⚠️ {videoInputError}
                </div>
              )}

              {/* Sample video quick-picks */}
              <div className="video-samples">
                <span>Quick try:</span>
                {SAMPLE_VIDEOS.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="video-sample-chip"
                    onClick={() => handleSetVideo(s.url)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Video Player Component */}
            <VideoPlayer
              videoId={roomState?.videoId || null}
              mediaType={roomState?.mediaType || 'youtube'}
              roomState={roomState}
              clockOffset={clockOffset}
              hasEnteredParty={hasEnteredParty}
              onEnterParty={() => setHasEnteredParty(true)}
              onSendPlay={handleSendPlay}
              onSendPause={handleSendPause}
              onSendSeek={handleSendSeek}
            />

            {/* Interactive Seating Area */}
            <div className="seating-section">
              <div className="seating-header">
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>
                    🛋️ Contueri Lounge
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                    {members.length} {members.length === 1 ? 'friend' : 'friends'} currently seated in the room
                  </p>
                </div>
                <button onClick={handleCopyInvite} className="btn-secondary" style={{ fontSize: '0.85rem', padding: '0.4em 0.8em' }}>
                  + Invite Friends
                </button>
              </div>

              {/* Theater Seats Grid */}
              <div className="seats-grid">
                {seats.map((seat, i) => (
                  <div
                    key={i}
                    className={`theater-seat ${seat.occupied ? 'occupied' : 'empty'} ${seat.isMe ? 'is-me' : ''}`}
                    onClick={() => {
                      if (!seat.occupied) {
                        handleCopyInvite();
                      }
                    }}
                    title={seat.occupied ? (seat.isMe ? 'Your Seat' : `${seat.nickname}'s Seat`) : 'Empty Seat - Click to copy invite link'}
                  >
                    <div className="seat-avatar">
                      {seat.avatar}
                    </div>
                    <div className="seat-name">
                      {seat.occupied ? seat.nickname : `Seat #${i + 1}`}
                    </div>
                    {seat.occupied ? (
                      <span className={`seat-tag ${seat.isMe ? 'seat-tag-me' : 'seat-tag-friend'}`}>
                        {seat.isMe ? 'YOU' : 'SEATED'}
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.25rem' }}>
                        + Available
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Sidebar: Chat, Members, & Lounge */}
          <aside className="sidebar">
            <div className="sidebar-tabs">
              <button
                className={`sidebar-tab ${activeTab === 'chat' ? 'active' : ''}`}
                onClick={() => setActiveTab('chat')}
              >
                💬 Chat {messages.length > 0 && `(${messages.length})`}
              </button>
              <button
                className={`sidebar-tab ${activeTab === 'members' ? 'active' : ''}`}
                onClick={() => setActiveTab('members')}
              >
                👥 Members ({members.length})
              </button>
              <button
                className={`sidebar-tab ${activeTab === 'lounge' ? 'active' : ''}`}
                onClick={() => setActiveTab('lounge')}
              >
                🛋️ Lounge Info
              </button>
            </div>

            {activeTab === 'chat' && (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                {rateLimitWarning && (
                  <div style={{ background: '#7f1d1d', color: '#fecaca', padding: '0.5rem 0.75rem', fontSize: '0.85rem', textAlign: 'center' }}>
                    ⚠️ {rateLimitWarning}
                  </div>
                )}

                <div
                  ref={chatContainerRef}
                  onScroll={handleChatScroll}
                  className="chat-messages-container"
                >
                  {messages.length === 0 ? (
                    <div style={{ color: '#64748b', textAlign: 'center', margin: 'auto' }}>
                      No messages yet. Say hello to the room!
                    </div>
                  ) : (
                    messages.map((msg, idx) => {
                      if (msg.isSystem) {
                        const isJoin = msg.text.includes('joined');
                        return (
                          <div key={msg.id || idx} className="chat-system-line">
                            <span>{isJoin ? '👋' : '🚪'}</span>
                            <span>{msg.text}</span>
                            <span style={{ fontSize: '0.7rem', opacity: 0.6, marginLeft: '0.25rem' }}>
                              {new Date(msg.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        );
                      }

                      const isMine = msg.nickname.toLowerCase() === nickname.toLowerCase();
                      return (
                        <div
                          key={msg.id || idx}
                          className={`chat-bubble ${isMine ? 'mine' : 'theirs'}`}
                        >
                          <div className="chat-bubble-author">
                            <span>{getAvatarForName(msg.nickname)}</span>
                            <span>{isMine ? 'You' : msg.nickname}</span>
                          </div>
                          <div style={{ lineHeight: 1.4 }}>{msg.text}</div>
                          <span className="chat-bubble-time">
                            {new Date(msg.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      );
                    })
                  )}
                  <div ref={chatMessagesEndRef} />
                </div>

                <form onSubmit={handleSendChat} className="chat-input-bar">
                  <input
                    type="text"
                    placeholder="Type a message..."
                    value={chatInput}
                    maxLength={MAX_CHAT_TEXT_LENGTH}
                    onChange={(e) => setChatInput(e.target.value)}
                  />
                  <button type="submit" disabled={!chatInput.trim()}>
                    Send
                  </button>
                </form>
              </div>
            )}

            {activeTab === 'members' && (
              <div className="sidebar-content">
                {members.length === 0 ? (
                  <div style={{ color: '#64748b', textAlign: 'center', marginTop: '2rem' }}>
                    No members in room.
                  </div>
                ) : (
                  members.map((member, idx) => {
                    const isMe = member.toLowerCase() === nickname.toLowerCase();
                    return (
                      <div key={idx} className="member-item">
                        <span style={{ fontSize: '1.2rem' }}>{getAvatarForName(member)}</span>
                        <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <span style={{ fontWeight: isMe ? 700 : 500, color: isMe ? '#34d399' : '#f1f5f9' }}>
                            {member}
                          </span>
                          {isMe && <span style={{ fontSize: '0.75rem', color: '#10b981', marginLeft: '0.5rem' }}>(You)</span>}
                        </div>
                        <div className="member-dot" />
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {activeTab === 'lounge' && (
              <div className="sidebar-content">
                <div style={{ padding: '0.5rem', background: '#161f33', borderRadius: '8px', border: '1px solid #1e293b' }}>
                  <h4 style={{ color: '#6366f1', marginBottom: '0.5rem' }}>Lounge Room Info</h4>
                  <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
                    <strong>Code:</strong> {roomCode}
                  </p>
                  <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
                    <strong>Total Seats:</strong> {TOTAL_SEATS} ({members.length} occupied)
                  </p>
                  <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
                    <strong>Your Name:</strong> {nickname}
                  </p>
                  <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                    <strong>Current Media:</strong> {roomState?.videoId ? `${roomState.videoId} (${roomState.mediaType})` : 'None'}
                  </p>
                </div>
              </div>
            )}
          </aside>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="toast">
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
