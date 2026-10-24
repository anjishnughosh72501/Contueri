// Shared room constants
export const ROOM_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const ROOM_CODE_LENGTH = 6;
export const MAX_CHAT_HISTORY = 50;
export const MAX_NICKNAME_LENGTH = 20;
export const MIN_NICKNAME_LENGTH = 2;
export const MAX_CHAT_TEXT_LENGTH = 500;
export const CHAT_RATE_LIMIT_COUNT = 5;
export const CHAT_RATE_LIMIT_WINDOW_MS = 5000;

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

// Client to Server messages
export type ClientMessage =
  | { type: 'join'; nickname: string }
  | { type: 'setVideo'; videoId: string; mediaType?: MediaType }
  | { type: 'play'; positionSec: number }
  | { type: 'pause'; positionSec: number }
  | { type: 'seek'; positionSec: number }
  | { type: 'chat'; text: string }
  | { type: 'ping' };

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
  | { type: 'members'; nicknames: string[] }
  | { type: 'chat'; nickname: string; text: string; time: number; isSystem?: boolean }
  | { type: 'history'; messages: ChatMessage[] }
  | { type: 'error'; message: string }
  | { type: 'pong'; serverTime: number };

// List of Pokemon for automatic nickname generation
export const POKEMON_NAMES = [
  'Pikachu', 'Charizard', 'Bulbasaur', 'Squirtle', 'Eevee',
  'Snorlax', 'Gengar', 'Lucario', 'Mewtwo', 'Jigglypuff',
  'Togepi', 'Psyduck', 'Dragonite', 'Lapras', 'Gardevoir',
  'Garchomp', 'Greninja', 'Rayquaza', 'Umbreon', 'Sylveon',
  'Blastoise', 'Venusaur', 'Arcanine', 'Alakazam', 'Machamp',
  'Gengar', 'Vaporeon', 'Jolteon', 'Flareon', 'Mew',
  'Cyndaquil', 'Totodile', 'Chikorita', 'Tyranitar', 'Lugia',
  'Torchic', 'Mudkip', 'Treecko', 'Blaziken', 'Metagross',
  'Piplup', 'Chimchar', 'Turtwig', 'Infernape', 'Darkrai',
  'Zoroark', 'Mimikyu', 'Cinderace', 'Lucario', 'Rowlet'
];

export function generatePokemonNickname(): string {
  const name = POKEMON_NAMES[Math.floor(Math.random() * POKEMON_NAMES.length)];
  const num = Math.floor(10 + Math.random() * 90); // 2-digit number e.g. Pikachu-42
  return `${name}-${num}`;
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
