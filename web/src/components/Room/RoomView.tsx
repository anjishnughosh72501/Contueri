import React, { useState, useEffect } from 'react';
import { useRoomSocket } from '../../hooks/useRoomSocket';
import { Header } from '../Header';
import { Screen } from './Screen';
import { VideoBar } from './VideoBar';
import { Lounge } from './Lounge';
import { ReactionLayer } from './ReactionLayer';
import { Sidebar } from './Sidebar';
import { ReadyCheck } from './ReadyCheck';
import { ActivityTicker } from './ActivityTicker';
import { RoomSettings } from './RoomSettings';
import { QrModal } from './QrModal';

interface RoomViewProps {
  roomCode: string;
  onNavigateHome: () => void;
}

export const RoomView: React.FC<RoomViewProps> = ({ roomCode, onNavigateHome }) => {
  const [activeTab, setActiveTab] = useState<'chat' | 'people' | 'queue' | 'activities'>('chat');
  const [hasEnteredParty, setHasEnteredParty] = useState(false);
  const [focusMode, setFocusMode] = useState<boolean>(() => {
    return localStorage.getItem('ct_focus_mode') === 'true';
  });
  const [showSettings, setShowSettings] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const {
    state,
    dispatch,
    sendChat,
    sendSetVideo,
    sendPlay,
    sendPause,
    sendSeek,
    sendSit,
    sendStand,
    sendReaction,
    sendEmote,
    sendTyping,
    sendReadyCheckStart,
    sendReady,
    sendReadyCheckCancel,
    sendQueueAdd,
    sendQueueVote,
    sendQueueRemove,
    sendQueuePlayNext,
    sendVideoEnded,
    sendSetRoomMeta,
    sendPopcorn,
    sendSetActivity,
    sendPollCreate,
    sendPollVote,
    sendPollClose,
    sendTttJoin,
    sendTttMove,
    sendTttReset,
    sendDrawStroke,
    sendDrawClear,
  } = useRoomSocket(roomCode, activeTab);

  // Set data-theme on root element
  useEffect(() => {
    const theme = state.meta.theme || 'cinema';
    document.documentElement.setAttribute('data-theme', theme);
  }, [state.meta.theme]);

  // Record in recent rooms
  useEffect(() => {
    if (!roomCode) return;
    try {
      const stored = localStorage.getItem('ct_recent_rooms');
      const list = stored ? JSON.parse(stored) : [];
      const updated = [
        { code: roomCode, name: state.meta.name || 'Hangout Lounge', lastVisited: Date.now() },
        ...list.filter((r: any) => r.code !== roomCode),
      ].slice(0, 8);
      localStorage.setItem('ct_recent_rooms', JSON.stringify(updated));
    } catch {}
  }, [roomCode, state.meta.name]);

  // Focus mode Esc key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && focusMode) {
        setFocusMode(false);
        localStorage.setItem('ct_focus_mode', 'false');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusMode]);

  const handleToggleFocusMode = () => {
    const next = !focusMode;
    setFocusMode(next);
    localStorage.setItem('ct_focus_mode', String(next));
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleCopyInvite = async () => {
    const url = `${window.location.origin}/r/${roomCode}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join Contueri Lounge ${roomCode}`,
          url,
        });
        return;
      } catch {}
    }

    try {
      await navigator.clipboard.writeText(url);
      showToast('Invite link copied to clipboard!');
    } catch {
      showToast(url);
    }
  };

  const currentMemberName = state.currentMember?.nickname || '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header
        roomCode={roomCode}
        roomName={state.meta.name}
        voiceUrl={state.meta.voiceUrl}
        connectionStatus={state.connectionStatus}
        focusMode={focusMode}
        onToggleFocusMode={handleToggleFocusMode}
        onOpenSettings={() => setShowSettings(true)}
        onCopyInvite={handleCopyInvite}
        onShareQr={() => setShowQr(true)}
        onLeaveRoom={onNavigateHome}
        onNavigateHome={onNavigateHome}
      />

      <div className={`room-container ${focusMode ? 'focus-mode' : ''}`}>
        <main className="main-stage">
          <ReactionLayer
            reactions={state.reactions}
            onRemoveReaction={(id) => dispatch({ type: 'REMOVE_REACTION', id })}
          />

          <ReadyCheck
            readyCheck={state.readyCheck}
            members={state.members}
            selfId={state.selfId}
            onToggleReady={sendReady}
            onCancel={sendReadyCheckCancel}
          />

          <VideoBar onLoadVideo={(url) => sendSetVideo(url)} />

          <Screen
            videoId={state.roomState?.videoId || null}
            mediaType={state.roomState?.mediaType}
            roomState={state.roomState}
            clockOffset={state.clockOffset}
            hasEnteredParty={hasEnteredParty}
            readyCheck={state.readyCheck}
            onEnterParty={() => setHasEnteredParty(true)}
            onSendPlay={sendPlay}
            onSendPause={sendPause}
            onSendSeek={sendSeek}
            onVideoEnded={sendVideoEnded}
          />

          <ActivityTicker lines={state.activityLines} />

          <Lounge
            members={state.members}
            selfId={state.selfId}
            speechBubbles={state.speechBubbles}
            readyCheck={state.readyCheck}
            popcornCount={state.meta.popcorn}
            onSit={sendSit}
            onStand={sendStand}
            onSendReaction={sendReaction}
            onSendEmote={sendEmote}
            onSendPopcorn={sendPopcorn}
            onStartReadyCheck={sendReadyCheckStart}
            onToggleReady={sendReady}
          />
        </main>

        <Sidebar
          activeTab={activeTab}
          unreadChatCount={state.unreadChatCount}
          messages={state.chatMessages}
          currentMemberName={currentMemberName}
          typingMembers={state.typingMembers}
          members={state.members}
          queue={state.queue}
          activity={state.activity}
          selfId={state.selfId}
          onSelectTab={setActiveTab}
          onSendMessage={sendChat}
          onTyping={sendTyping}
          onSendEmote={sendEmote}
          onQueueAdd={sendQueueAdd}
          onQueueVote={sendQueueVote}
          onQueueRemove={sendQueueRemove}
          onQueuePlayNext={sendQueuePlayNext}
          onSetActivity={sendSetActivity}
          onPollCreate={sendPollCreate}
          onPollVote={sendPollVote}
          onPollClose={sendPollClose}
          onTttJoin={sendTttJoin}
          onTttMove={sendTttMove}
          onTttReset={sendTttReset}
          onDrawStroke={sendDrawStroke}
          onDrawClear={sendDrawClear}
        />
      </div>

      {showSettings && (
        <RoomSettings
          currentName={state.meta.name}
          currentTheme={state.meta.theme}
          currentVoiceUrl={state.meta.voiceUrl}
          onSave={(name, theme, voice) => sendSetRoomMeta(name, theme, voice)}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showQr && (
        <QrModal
          url={`${window.location.origin}/r/${roomCode}`}
          roomCode={roomCode}
          onClose={() => setShowQr(false)}
        />
      )}

      {toastMessage && <div className="toast" role="status">{toastMessage}</div>}

      {state.serverError && (
        <div className="toast" style={{ borderColor: 'var(--danger)' }} role="alert">
          <span>⚠️ {state.serverError}</span>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => dispatch({ type: 'CLEAR_ERROR' })}
            style={{ padding: '0.2em 0.5em', fontSize: '0.75rem' }}
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
};
