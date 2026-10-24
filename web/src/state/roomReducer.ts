import {
  Member,
  RoomState,
  ChatMessage,
  QueueItem,
  RoomMeta,
  ActivityState,
  ReadyCheckState,
  ServerMessage,
} from '@contueri/shared';

export interface FloatingReaction {
  id: string;
  fromId: string;
  emoji: string;
  x: number;
}

export interface ActivityLine {
  id: string;
  text: string;
  time: number;
  actorId?: string;
}

export interface RoomUiState {
  connectionStatus: 'disconnected' | 'connecting' | 'connected';
  selfId: string | null;
  currentMember: Member | null;
  roomState: RoomState | null;
  members: Member[];
  chatMessages: ChatMessage[];
  queue: QueueItem[];
  meta: RoomMeta;
  activityLines: ActivityLine[];
  readyCheck: ReadyCheckState;
  activity: ActivityState;
  reactions: FloatingReaction[];
  speechBubbles: Record<string, { text: string; timestamp: number }>; // memberId -> speech bubble
  typingMembers: Record<string, boolean>; // memberId -> isTyping
  unreadChatCount: number;
  clockOffset: number;
  serverError: string | null;
}

export const initialRoomState: RoomUiState = {
  connectionStatus: 'disconnected',
  selfId: null,
  currentMember: null,
  roomState: null,
  members: [],
  chatMessages: [],
  queue: [],
  meta: {
    name: 'Hangout Lounge',
    theme: 'cinema',
    popcorn: 0,
    voiceUrl: null,
  },
  activityLines: [],
  readyCheck: { phase: 'idle', readyIds: [] },
  activity: { type: null },
  reactions: [],
  speechBubbles: {},
  typingMembers: {},
  unreadChatCount: 0,
  clockOffset: 0,
  serverError: null,
};

export type RoomAction =
  | { type: 'SET_CONNECTION_STATUS'; status: 'disconnected' | 'connecting' | 'connected' }
  | { type: 'SET_CLOCK_OFFSET'; offset: number }
  | { type: 'HANDLE_SERVER_MESSAGE'; message: ServerMessage; activeTab?: string }
  | { type: 'CLEAR_UNREAD_CHAT' }
  | { type: 'CLEAR_ERROR' }
  | { type: 'REMOVE_REACTION'; id: string }
  | { type: 'CLEAR_SPEECH_BUBBLE'; memberId: string };

export function roomReducer(state: RoomUiState, action: RoomAction): RoomUiState {
  switch (action.type) {
    case 'SET_CONNECTION_STATUS':
      return { ...state, connectionStatus: action.status };

    case 'SET_CLOCK_OFFSET':
      return { ...state, clockOffset: action.offset };

    case 'CLEAR_UNREAD_CHAT':
      return { ...state, unreadChatCount: 0 };

    case 'CLEAR_ERROR':
      return { ...state, serverError: null };

    case 'REMOVE_REACTION':
      return {
        ...state,
        reactions: state.reactions.filter(r => r.id !== action.id),
      };

    case 'CLEAR_SPEECH_BUBBLE': {
      const nextBubbles = { ...state.speechBubbles };
      delete nextBubbles[action.memberId];
      return { ...state, speechBubbles: nextBubbles };
    }

    case 'HANDLE_SERVER_MESSAGE': {
      const msg = action.message;

      if (msg.type === 'welcome') {
        return {
          ...state,
          selfId: msg.selfId,
          currentMember: msg.member,
        };
      }

      if (msg.type === 'state') {
        return {
          ...state,
          roomState: {
            videoId: msg.videoId,
            mediaType: msg.mediaType,
            isPlaying: msg.isPlaying,
            positionSec: msg.positionSec,
            updatedAt: msg.updatedAt,
          },
        };
      }

      if (msg.type === 'members') {
        const myMember = state.selfId ? msg.members.find(m => m.id === state.selfId) || state.currentMember : state.currentMember;
        return {
          ...state,
          members: msg.members,
          currentMember: myMember,
        };
      }

      if (msg.type === 'chat') {
        const nextHistory = [...state.chatMessages, {
          id: crypto.randomUUID(),
          nickname: msg.nickname,
          text: msg.text,
          time: msg.time,
          isSystem: msg.isSystem,
        }];
        if (nextHistory.length > 50) nextHistory.shift();

        // Speech bubble over seat if not a system message
        const nextSpeechBubbles = { ...state.speechBubbles };
        if (!msg.isSystem) {
          const sender = state.members.find(m => m.nickname === msg.nickname);
          if (sender) {
            nextSpeechBubbles[sender.id] = {
              text: msg.text.length > 80 ? msg.text.slice(0, 80) + '...' : msg.text,
              timestamp: Date.now(),
            };
          }
        }

        const unreadInc = action.activeTab && action.activeTab !== 'chat' ? 1 : 0;

        return {
          ...state,
          chatMessages: nextHistory,
          speechBubbles: nextSpeechBubbles,
          unreadChatCount: state.unreadChatCount + unreadInc,
        };
      }

      if (msg.type === 'history') {
        return {
          ...state,
          chatMessages: msg.messages,
        };
      }

      if (msg.type === 'queue') {
        return {
          ...state,
          queue: msg.items,
        };
      }

      if (msg.type === 'meta') {
        return {
          ...state,
          meta: {
            name: msg.name,
            theme: msg.theme,
            popcorn: msg.popcorn,
            voiceUrl: msg.voiceUrl,
          },
        };
      }

      if (msg.type === 'activity') {
        const nextLines = [
          ...state.activityLines,
          { id: crypto.randomUUID(), text: msg.text, time: msg.time, actorId: msg.actorId }
        ].slice(-3); // keep last 3 lines
        return {
          ...state,
          activityLines: nextLines,
        };
      }

      if (msg.type === 'readyCheck') {
        return {
          ...state,
          readyCheck: {
            phase: msg.phase,
            readyIds: msg.readyIds,
            startAt: msg.startAt,
          },
        };
      }

      if (msg.type === 'activityState') {
        return {
          ...state,
          activity: msg.activity,
        };
      }

      if (msg.type === 'reaction') {
        const nextReactions = [
          ...state.reactions,
          { id: crypto.randomUUID(), fromId: msg.fromId, emoji: msg.emoji, x: msg.x }
        ].slice(-30); // cap concurrent reactions at 30
        return {
          ...state,
          reactions: nextReactions,
        };
      }

      if (msg.type === 'typing') {
        return {
          ...state,
          typingMembers: {
            ...state.typingMembers,
            [msg.id]: msg.isTyping,
          },
        };
      }

      if (msg.type === 'error') {
        return {
          ...state,
          serverError: msg.message,
        };
      }

      return state;
    }

    default:
      return state;
  }
}
