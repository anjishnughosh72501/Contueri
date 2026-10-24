import { useState, useEffect } from 'react';
import { HomeView } from './components/Home/HomeView';
import { JoinPrompt } from './components/JoinPrompt';
import { RoomView } from './components/Room/RoomView';
import { Header } from './components/Header';
import { sanitizeRoomCode } from '@contueri/shared';

const WORKER_HTTP_BASE = (import.meta.env.VITE_WORKER_URL || '').replace(/\/$/, '');

export default function App() {
  const [currentPath, setCurrentPath] = useState<string>(window.location.pathname);
  const [isCreatingRoom, setIsCreatingRoom] = useState<boolean>(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Sync client-side routing on popstate (Back/Forward buttons)
  useEffect(() => {
    const handlePopState = () => setCurrentPath(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (path: string) => {
    if (window.location.pathname !== path) {
      window.history.pushState(null, '', path);
      setCurrentPath(path);
    }
  };

  // Match /r/:code
  const roomMatch = currentPath.match(/^\/r\/([^/]+)/);
  const activeRoomCode = roomMatch ? sanitizeRoomCode(roomMatch[1]) : '';

  // Has joined prompt state
  const [hasConfirmedPrompt, setHasConfirmedPrompt] = useState<boolean>(() => {
    // If nickname already stored, skip prompt
    return !!localStorage.getItem('ct_nickname');
  });

  const handleCreateRoom = async () => {
    setIsCreatingRoom(true);
    setCreateError(null);

    try {
      const endpoint = `${WORKER_HTTP_BASE}/api/rooms`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        throw new Error(`Failed to create room (HTTP ${res.status})`);
      }

      const data = await res.json() as { code: string };
      if (!data.code) {
        throw new Error('Invalid room code response from server');
      }

      setHasConfirmedPrompt(true);
      navigateTo(`/r/${data.code}`);
    } catch (err: unknown) {
      console.error('Room creation error:', err);
      setCreateError(err instanceof Error ? err.message : 'Could not create room');
    } finally {
      setIsCreatingRoom(false);
    }
  };

  const handleJoinFromHome = (code: string) => {
    setHasConfirmedPrompt(true);
    navigateTo(`/r/${code}`);
  };

  const handleConfirmPrompt = (nickname: string, avatar: string, color: string) => {
    localStorage.setItem('ct_nickname', nickname);
    localStorage.setItem('ct_avatar', avatar);
    localStorage.setItem('ct_color', color);
    setHasConfirmedPrompt(true);
  };

  // 1. In Room
  if (activeRoomCode) {
    if (!hasConfirmedPrompt && !localStorage.getItem('ct_nickname')) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
          <Header onNavigateHome={() => navigateTo('/')} />
          <JoinPrompt
            roomCode={activeRoomCode}
            onConfirmJoin={handleConfirmPrompt}
            onCancel={() => navigateTo('/')}
          />
        </div>
      );
    }

    return (
      <RoomView
        roomCode={activeRoomCode}
        onNavigateHome={() => navigateTo('/')}
      />
    );
  }

  // 2. Home view
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header onNavigateHome={() => navigateTo('/')} />
      <HomeView
        onJoinRoom={handleJoinFromHome}
        onCreateRoom={handleCreateRoom}
        isCreating={isCreatingRoom}
        createError={createError}
      />
    </div>
  );
}
