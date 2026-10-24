// Shared room constants
export const ROOM_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const ROOM_CODE_LENGTH = 6;
export const MAX_CHAT_HISTORY = 50;
export const MAX_NICKNAME_LENGTH = 20;
export const MIN_NICKNAME_LENGTH = 2;
export const MAX_CHAT_TEXT_LENGTH = 500;
export const CHAT_RATE_LIMIT_COUNT = 5;
export const CHAT_RATE_LIMIT_WINDOW_MS = 5000;

export const SEAT_COUNT = 12;

export const AVATAR_EMOJIS = [
  '🍿', '🥤', '🎬', '🍕', '🎧', '🍦', '🍩', '🍫', '✨', '🦊', '🐼', '🚀',
  '👾', '🐱', '🐶', '🐸', '🐯', '🦁', '🐻', '🦄', '🐙', '🎸', '⚡', '💎'
] as const;

export const AVATAR_COLORS = [
  '#6366f1', '#ec4899', '#f59e0b', '#10b981',
  '#06b6d4', '#8b5cf6', '#f43f5e', '#14b8a6'
] as const;

export const REACTION_EMOJIS = ['🔥', '😂', '😭', '👏', '😮', '❤️', '🍿', '👀'] as const;

export const EMOTES = ['wave', 'popcorn', 'highfive', 'dance', 'shush'] as const;
export type EmoteKind = typeof EMOTES[number];

export const THEMES = ['cinema', 'living-room', 'campfire', 'rooftop'] as const;
export type Theme = typeof THEMES[number];

export const MAX_ROOM_NAME_LENGTH = 30;
export const MAX_QUEUE_ITEMS = 20;

// Rate limits
export const REACTION_RATE_LIMIT_COUNT = 6;
export const REACTION_RATE_LIMIT_WINDOW_MS = 2000;
export const EMOTE_RATE_LIMIT_COUNT = 4;
export const EMOTE_RATE_LIMIT_WINDOW_MS = 3000;
export const TYPING_RATE_LIMIT_COUNT = 6;
export const TYPING_RATE_LIMIT_WINDOW_MS = 2000;
export const POPCORN_RATE_LIMIT_COUNT = 20;
export const POPCORN_RATE_LIMIT_WINDOW_MS = 3000;
export const DRAW_RATE_LIMIT_COUNT = 25;
export const DRAW_RATE_LIMIT_WINDOW_MS = 2000;
export const QUEUE_RATE_LIMIT_COUNT = 10;
export const QUEUE_RATE_LIMIT_WINDOW_MS = 5000;

export type MediaType = 'youtube' | 'direct' | 'iframe' | 'browser';

export interface RoomState {
  videoId: string | null; // YouTube 11-char ID or media URL
  mediaType?: MediaType;
  isPlaying: boolean;
  positionSec: number;
  updatedAt: number; // Server timestamp in milliseconds
}

export interface ChatMessage {
  id: string;
  nickname: string;
  text: string;
  time: number; // Server timestamp in milliseconds
  isSystem?: boolean;
}

export interface Member {
  id: string;
  clientId: string;
  nickname: string;
  avatar: string;
  color: string;
  seat: number | null;
  ready: boolean;
}

export interface QueueItem {
  id: string;
  videoId: string;
  mediaType: MediaType;
  title?: string;
  addedBy: string;
  addedByNickname: string;
  voters: string[]; // clientIds
}

export interface RoomMeta {
  name: string;
  theme: Theme;
  popcorn: number;
  voiceUrl: string | null;
}

export interface PollState {
  id: string;
  question: string;
  options: string[];
  votes: Record<string, number>; // clientId -> option index
  creatorId: string;
  closed: boolean;
}

export interface TicTacToeState {
  board: (('X' | 'O' | null)[]);
  turn: 'X' | 'O';
  players: { X: string | null; O: string | null; XName?: string; OName?: string };
  winner: 'X' | 'O' | 'draw' | null;
}

export interface DrawStroke {
  points: { x: number; y: number }[];
  color: string;
  width: number;
}

export interface ActivityState {
  type: 'poll' | 'tictactoe' | 'draw' | null;
  poll?: PollState;
  tictactoe?: TicTacToeState;
}

export interface ReadyCheckState {
  phase: 'idle' | 'checking' | 'countdown';
  readyIds: string[];
  startAt?: number;
}

// Client to Server messages
export type ClientMessage =
  | { type: 'join'; clientId: string; nickname: string; avatar?: string; color?: string }
  | { type: 'setVideo'; videoId: string; mediaType?: MediaType }
  | { type: 'play'; positionSec: number }
  | { type: 'pause'; positionSec: number }
  | { type: 'seek'; positionSec: number }
  | { type: 'chat'; text: string }
  | { type: 'ping' }
  | { type: 'sit'; seat: number }
  | { type: 'stand' }
  | { type: 'reaction'; emoji: string }
  | { type: 'emote'; kind: EmoteKind; targetId?: string }
  | { type: 'typing'; isTyping: boolean }
  | { type: 'readyCheckStart' }
  | { type: 'ready'; ready: boolean }
  | { type: 'readyCheckCancel' }
  | { type: 'queueAdd'; url: string }
  | { type: 'queueVote'; itemId: string }
  | { type: 'queueRemove'; itemId: string }
  | { type: 'queuePlayNext' }
  | { type: 'videoEnded'; videoId: string }
  | { type: 'setRoomMeta'; name?: string; theme?: Theme; voiceUrl?: string | null }
  | { type: 'popcorn' }
  | { type: 'setActivity'; activityType: 'poll' | 'tictactoe' | 'draw' | null }
  | { type: 'pollCreate'; question: string; options: string[] }
  | { type: 'pollVote'; optionIndex: number }
  | { type: 'pollClose' }
  | { type: 'tttJoin'; side: 'X' | 'O' }
  | { type: 'tttMove'; index: number }
  | { type: 'tttReset' }
  | { type: 'drawStroke'; stroke: DrawStroke }
  | { type: 'drawClear' };

// Server to Client messages
export type ServerMessage =
  | {
      type: 'state';
      videoId: string | null;
      mediaType?: MediaType;
      isPlaying: boolean;
      positionSec: number;
      updatedAt: number;
      serverTime: number;
    }
  | { type: 'welcome'; selfId: string; member: Member }
  | { type: 'members'; members: Member[] }
  | { type: 'chat'; nickname: string; text: string; time: number; isSystem?: boolean }
  | { type: 'history'; messages: ChatMessage[] }
  | { type: 'error'; message: string }
  | { type: 'pong'; serverTime: number }
  | { type: 'reaction'; fromId: string; emoji: string; x: number }
  | { type: 'emote'; fromId: string; kind: string; targetId?: string; fromName: string; targetName?: string }
  | { type: 'typing'; id: string; isTyping: boolean; nickname: string }
  | { type: 'activity'; text: string; time: number; actorId?: string }
  | { type: 'readyCheck'; phase: 'idle' | 'checking' | 'countdown'; readyIds: string[]; startAt?: number }
  | { type: 'queue'; items: QueueItem[] }
  | { type: 'meta'; name: string; theme: Theme; popcorn: number; voiceUrl: string | null }
  | { type: 'activityState'; activity: ActivityState }
  | { type: 'drawStroke'; stroke: DrawStroke }
  | { type: 'drawClear' };

// List of Pokemon for automatic nickname generation
export const POKEMON_NAMES = [
  'Pikachu', 'Charizard', 'Bulbasaur', 'Squirtle', 'Eevee',
  'Snorlax', 'Gengar', 'Lucario', 'Mewtwo', 'Jigglypuff',
  'Togepi', 'Psyduck', 'Dragonite', 'Lapras', 'Gardevoir',
  'Garchomp', 'Greninja', 'Rayquaza', 'Umbreon', 'Sylveon',
  'Blastoise', 'Venusaur', 'Arcanine', 'Alakazam', 'Machamp',
  'Vaporeon', 'Jolteon', 'Flareon', 'Mew',
  'Cyndaquil', 'Totodile', 'Chikorita', 'Tyranitar', 'Lugia',
  'Torchic', 'Mudkip', 'Treecko', 'Blaziken', 'Metagross',
  'Piplup', 'Chimchar', 'Turtwig', 'Infernape', 'Darkrai',
  'Zoroark', 'Mimikyu', 'Cinderace', 'Rowlet'
];

export function generatePokemonNickname(): string {
  const name = POKEMON_NAMES[Math.floor(Math.random() * POKEMON_NAMES.length)];
  const num = Math.floor(10 + Math.random() * 90); // 2-digit number e.g. Pikachu-42
  return `${name}-${num}`;
}

export function pickDefaultAvatar(clientId: string): { avatar: string; color: string } {
  let hash = 0;
  for (let i = 0; i < clientId.length; i++) {
    hash = (hash << 5) - hash + clientId.charCodeAt(i);
    hash |= 0;
  }
  const avatarIndex = Math.abs(hash) % AVATAR_EMOJIS.length;
  const colorIndex = Math.abs(hash >> 3) % AVATAR_COLORS.length;
  return {
    avatar: AVATAR_EMOJIS[avatarIndex],
    color: AVATAR_COLORS[colorIndex],
  };
}

// Helper to sanitize room code by removing all whitespace and uppercasing
export function sanitizeRoomCode(code: string): string {
  if (!code) return '';
  return code.replace(/\s+/g, '').toUpperCase();
}

// Helper to generate a room code
export function generateRoomCode(): string {
  let result = '';
  const chars = ROOM_CODE_ALPHABET;
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Helper to validate a room code format (spaces are completely ignored and stripped)
export function isValidRoomCode(code: string): boolean {
  if (!code) return false;
  const cleanCode = sanitizeRoomCode(code);
  if (cleanCode.length !== ROOM_CODE_LENGTH) {
    return false;
  }
  for (let i = 0; i < cleanCode.length; i++) {
    if (!ROOM_CODE_ALPHABET.includes(cleanCode[i])) {
      return false;
    }
  }
  return true;
}

// Helper to parse media links (YouTube, Vimeo, Dailymotion, direct MP4/WebM, or generic online embeds)
export function parseMediaUrl(input: string): { videoId: string; mediaType: MediaType } | null {
  if (!input) return null;
  let trimmed = input.trim();

  // If user pasted an entire <iframe> embed code snippet, extract the src URL
  const iframeSrcMatch = trimmed.match(/<iframe[^>]+src=["']([^"']+)["']/i);
  if (iframeSrcMatch) {
    trimmed = iframeSrcMatch[1];
  }

  // 1. YouTube 11-char ID directly
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return { videoId: trimmed, mediaType: 'youtube' };
  }

  // Auto-prefix https:// if scheme is missing but input looks like a domain name
  if (!/^https?:\/\//i.test(trimmed) && /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(trimmed)) {
    trimmed = `https://${trimmed}`;
  }

  // 2. Parse URL
  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();

    // YouTube URLs (youtube.com/watch?v=, youtu.be/, /shorts/, /embed/)
    if (host.includes('youtube.com') || host.includes('youtu.be')) {
      if (host.includes('youtu.be')) {
        const id = parsed.pathname.slice(1).split('/')[0];
        if (id && id.length === 11) {
          return { videoId: id, mediaType: 'youtube' };
        }
      }

      if (parsed.searchParams.has('v')) {
        const id = parsed.searchParams.get('v');
        if (id && id.length === 11) {
          return { videoId: id, mediaType: 'youtube' };
        }
      }

      const shortsMatch = parsed.pathname.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
      if (shortsMatch) {
        return { videoId: shortsMatch[1], mediaType: 'youtube' };
      }

      const embedMatch = parsed.pathname.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
      if (embedMatch) {
        return { videoId: embedMatch[1], mediaType: 'youtube' };
      }
    }

    // Vimeo URLs (vimeo.com/123456 -> player.vimeo.com/video/123456)
    if (host.includes('vimeo.com')) {
      const vimeoMatch = parsed.pathname.match(/\/(\d+)/);
      if (vimeoMatch) {
        return {
          videoId: `https://player.vimeo.com/video/${vimeoMatch[1]}`,
          mediaType: 'iframe',
        };
      }
    }

    // Dailymotion URLs (dailymotion.com/video/x7tgad0 -> dailymotion.com/embed/video/x7tgad0)
    if (host.includes('dailymotion.com')) {
      const dmMatch = parsed.pathname.match(/\/video\/([a-zA-Z0-9]+)/);
      if (dmMatch) {
        return {
          videoId: `https://www.dailymotion.com/embed/video/${dmMatch[1]}`,
          mediaType: 'iframe',
        };
      }
    }

    // Direct HTML5 video file (.mp4, .webm, .ogg, .mov, etc.)
    const directExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.m4v'];
    if (directExtensions.some((ext) => parsed.pathname.toLowerCase().endsWith(ext))) {
      return { videoId: trimmed, mediaType: 'direct' };
    }

    // Generic online website or embed link (runs in mini browser with stripped headers)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return { videoId: trimmed, mediaType: 'browser' };
    }
  } catch {
    // Not a valid URL
  }

  return null;
}
