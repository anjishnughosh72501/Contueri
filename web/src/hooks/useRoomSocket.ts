import { useEffect, useRef, useReducer, useCallback } from 'react';
import {
  ClientMessage,
  ServerMessage,
  MediaType,
  EmoteKind,
  Theme,
  DrawStroke,
} from '@contueri/shared';
import { roomReducer, initialRoomState, RoomUiState } from '../state/roomReducer';

export function getOrCreateClientId(): string {
  let id = localStorage.getItem('ct_client_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('ct_client_id', id);
  }
  return id;
}

export function useRoomSocket(roomCode: string, activeTab = 'chat') {
  const [state, dispatch] = useReducer(roomReducer, initialRoomState);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const reconnectTimeoutRef = useRef<any>(null);
  const pingIntervalRef = useRef<any>(null);
  const pingStartRef = useRef<number>(0);
  const activeTabRef = useRef<string>(activeTab);
  activeTabRef.current = activeTab;

  // Send typed ClientMessage
  const sendMessage = useCallback((msg: ClientMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const connect = useCallback(() => {
    if (!roomCode) return;

    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {}
    }

    dispatch({ type: 'SET_CONNECTION_STATUS', status: 'connecting' });

    const workerUrlEnv = import.meta.env.VITE_WORKER_URL || '';
    let wsUrl = '';
    if (workerUrlEnv) {
      const u = new URL(workerUrlEnv);
      const proto = u.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = `${proto}//${u.host}/api/rooms/${encodeURIComponent(roomCode)}/ws`;
    } else {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = `${proto}//${window.location.host}/api/rooms/${encodeURIComponent(roomCode)}/ws`;
    }

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      dispatch({ type: 'SET_CONNECTION_STATUS', status: 'connected' });
      reconnectAttemptsRef.current = 0;

      // Automatically join with stored or default identity
      const clientId = getOrCreateClientId();
      const savedNickname = localStorage.getItem('ct_nickname') || '';
      const savedAvatar = localStorage.getItem('ct_avatar') || undefined;
      const savedColor = localStorage.getItem('ct_color') || undefined;

      sendMessage({
        type: 'join',
        clientId,
        nickname: savedNickname,
        avatar: savedAvatar,
        color: savedColor,
      });

      // Start ping loop for clock sync
      pingStartRef.current = Date.now();
      sendMessage({ type: 'ping' });

      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = setInterval(() => {
        pingStartRef.current = Date.now();
        sendMessage({ type: 'ping' });
      }, 30000);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as ServerMessage;

        if (msg.type === 'pong') {
          const rtt = Date.now() - pingStartRef.current;
          const serverNowEstimated = msg.serverTime + rtt / 2;
          const offset = serverNowEstimated - Date.now();
          dispatch({ type: 'SET_CLOCK_OFFSET', offset });
          return;
        }

        dispatch({
          type: 'HANDLE_SERVER_MESSAGE',
          message: msg,
          activeTab: activeTabRef.current,
        });
      } catch (err) {
        console.error('Error handling WebSocket message:', err);
      }
    };

    ws.onclose = (event) => {
      dispatch({ type: 'SET_CONNECTION_STATUS', status: 'disconnected' });
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);

      // Code 4000 = replaced by another tab/window with same clientId -> do NOT reconnect!
      if (event.code === 4000) {
        console.log('Session replaced by newer connection');
        return;
      }

      // Reconnect with backoff
      const nextDelay = Math.min(1000 * Math.pow(1.5, reconnectAttemptsRef.current), 10000);
      reconnectAttemptsRef.current += 1;
      reconnectTimeoutRef.current = setTimeout(connect, nextDelay);
    };

    ws.onerror = () => {
      try {
        ws.close();
      } catch {}
    };
  }, [roomCode, sendMessage]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {}
      }
    };
  }, [connect]);

  // Clean speech bubbles after 4s
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      for (const [id, bubble] of Object.entries(state.speechBubbles)) {
        if (now - bubble.timestamp > 4000) {
          dispatch({ type: 'CLEAR_SPEECH_BUBBLE', memberId: id });
        }
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [state.speechBubbles]);

  // Clear unread chat on tab active
  useEffect(() => {
    if (activeTab === 'chat') {
      dispatch({ type: 'CLEAR_UNREAD_CHAT' });
    }
  }, [activeTab]);

  return {
    state: state as RoomUiState,
    dispatch,
    sendJoin: (nickname: string, avatar?: string, color?: string) =>
      sendMessage({ type: 'join', clientId: getOrCreateClientId(), nickname, avatar, color }),
    sendChat: (text: string) => sendMessage({ type: 'chat', text }),
    sendSetVideo: (videoId: string, mediaType?: MediaType) =>
      sendMessage({ type: 'setVideo', videoId, mediaType }),
    sendPlay: (positionSec: number) => sendMessage({ type: 'play', positionSec }),
    sendPause: (positionSec: number) => sendMessage({ type: 'pause', positionSec }),
    sendSeek: (positionSec: number) => sendMessage({ type: 'seek', positionSec }),
    sendSit: (seat: number) => sendMessage({ type: 'sit', seat }),
    sendStand: () => sendMessage({ type: 'stand' }),
    sendReaction: (emoji: string) => sendMessage({ type: 'reaction', emoji }),
    sendEmote: (kind: EmoteKind, targetId?: string) => sendMessage({ type: 'emote', kind, targetId }),
    sendTyping: (isTyping: boolean) => sendMessage({ type: 'typing', isTyping }),
    sendReadyCheckStart: () => sendMessage({ type: 'readyCheckStart' }),
    sendReady: (ready: boolean) => sendMessage({ type: 'ready', ready }),
    sendReadyCheckCancel: () => sendMessage({ type: 'readyCheckCancel' }),
    sendQueueAdd: (url: string) => sendMessage({ type: 'queueAdd', url }),
    sendQueueVote: (itemId: string) => sendMessage({ type: 'queueVote', itemId }),
    sendQueueRemove: (itemId: string) => sendMessage({ type: 'queueRemove', itemId }),
    sendQueuePlayNext: () => sendMessage({ type: 'queuePlayNext' }),
    sendVideoEnded: (videoId: string) => sendMessage({ type: 'videoEnded', videoId }),
    sendSetRoomMeta: (name?: string, theme?: Theme, voiceUrl?: string | null) =>
      sendMessage({ type: 'setRoomMeta', name, theme, voiceUrl }),
    sendPopcorn: () => sendMessage({ type: 'popcorn' }),
    sendSetActivity: (activityType: 'poll' | 'tictactoe' | 'draw' | null) =>
      sendMessage({ type: 'setActivity', activityType }),
    sendPollCreate: (question: string, options: string[]) =>
      sendMessage({ type: 'pollCreate', question, options }),
    sendPollVote: (optionIndex: number) => sendMessage({ type: 'pollVote', optionIndex }),
    sendPollClose: () => sendMessage({ type: 'pollClose' }),
    sendTttJoin: (side: 'X' | 'O') => sendMessage({ type: 'tttJoin', side }),
    sendTttMove: (index: number) => sendMessage({ type: 'tttMove', index }),
    sendTttReset: () => sendMessage({ type: 'tttReset' }),
    sendDrawStroke: (stroke: DrawStroke) => sendMessage({ type: 'drawStroke', stroke }),
    sendDrawClear: () => sendMessage({ type: 'drawClear' }),
  };
}
