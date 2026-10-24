import { DurableObject } from "cloudflare:workers";
import {
  ClientMessage,
  ServerMessage,
  RoomState,
  ChatMessage,
  Member,
  QueueItem,
  RoomMeta,
  ActivityState,
  ReadyCheckState,
  SEAT_COUNT,
  AVATAR_EMOJIS,
  AVATAR_COLORS,
  REACTION_EMOJIS,
  EMOTES,
  THEMES,
  Theme,
  MAX_ROOM_NAME_LENGTH,
  MAX_QUEUE_ITEMS,
  generateRoomCode,
  isValidRoomCode,
  MIN_NICKNAME_LENGTH,
  MAX_NICKNAME_LENGTH,
  MAX_CHAT_TEXT_LENGTH,
  MAX_CHAT_HISTORY,
  CHAT_RATE_LIMIT_COUNT,
  CHAT_RATE_LIMIT_WINDOW_MS,
  REACTION_RATE_LIMIT_COUNT,
  REACTION_RATE_LIMIT_WINDOW_MS,
  EMOTE_RATE_LIMIT_COUNT,
  EMOTE_RATE_LIMIT_WINDOW_MS,
  TYPING_RATE_LIMIT_COUNT,
  TYPING_RATE_LIMIT_WINDOW_MS,
  POPCORN_RATE_LIMIT_COUNT,
  POPCORN_RATE_LIMIT_WINDOW_MS,
  DRAW_RATE_LIMIT_COUNT,
  DRAW_RATE_LIMIT_WINDOW_MS,
  QUEUE_RATE_LIMIT_COUNT,
  QUEUE_RATE_LIMIT_WINDOW_MS,
  parseMediaUrl,
  generatePokemonNickname,
  pickDefaultAvatar,
  sanitizeRoomCode,
} from "@contueri/shared";
import { isBlockedUrl } from "./ssrf";
import { createInitialTicTacToe, checkTicTacToeWinner, createPoll } from "./games";

export interface Env {
  ROOM_DO: DurableObjectNamespace<RoomDO>;
}

interface SocketAttachment {
  id: string; // unique connection id
  clientId: string; // stable client id
  nickname: string;
  avatar: string;
  color: string;
  seat: number | null;
  ready: boolean;
  isReplaced?: boolean;

  // Rate-limiting windows
  chatWindowStart: number;
  chatCount: number;
  reactionWindowStart: number;
  reactionCount: number;
  emoteWindowStart: number;
  emoteCount: number;
  typingWindowStart: number;
  typingCount: number;
  popcornWindowStart: number;
  popcornCount: number;
  drawWindowStart: number;
  drawCount: number;
  queueWindowStart: number;
  queueCount: number;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export class RoomDO extends DurableObject<Env> {
  private readyCheckState: ReadyCheckState = { phase: "idle", readyIds: [] };
  private readyCheckTimeoutId?: any;
  private popcornPending = 0;
  private popcornFlushTimeoutId?: any;
  private lastAutoAdvanceTime = 0;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  private async getRoomState(): Promise<RoomState> {
    const state = await this.ctx.storage.get<RoomState>("room_state");
    if (state) {
      return state;
    }
    const defaultState: RoomState = {
      videoId: null,
      isPlaying: false,
      positionSec: 0,
      updatedAt: Date.now(),
    };
    await this.ctx.storage.put("room_state", defaultState);
    return defaultState;
  }

  private async getChatHistory(): Promise<ChatMessage[]> {
    return (await this.ctx.storage.get<ChatMessage[]>("chat_history")) || [];
  }

  private async addChatMessage(msg: ChatMessage): Promise<void> {
    const history = await this.getChatHistory();
    history.push(msg);
    if (history.length > MAX_CHAT_HISTORY) {
      history.splice(0, history.length - MAX_CHAT_HISTORY);
    }
    await this.ctx.storage.put("chat_history", history);
  }

  private async getQueue(): Promise<QueueItem[]> {
    return (await this.ctx.storage.get<QueueItem[]>("queue")) || [];
  }

  private async saveQueue(items: QueueItem[]): Promise<void> {
    await this.ctx.storage.put("queue", items);
  }

  private async getRoomMeta(): Promise<RoomMeta> {
    const meta = await this.ctx.storage.get<RoomMeta>("room_meta");
    if (meta) return meta;
    const defaultMeta: RoomMeta = {
      name: "Hangout Lounge",
      theme: "cinema",
      popcorn: 0,
      voiceUrl: null,
    };
    await this.ctx.storage.put("room_meta", defaultMeta);
    return defaultMeta;
  }

  private async saveRoomMeta(meta: RoomMeta): Promise<void> {
    await this.ctx.storage.put("room_meta", meta);
  }

  private async getActivityState(): Promise<ActivityState> {
    return (await this.ctx.storage.get<ActivityState>("activity_state")) || { type: null };
  }

  private async saveActivityState(activity: ActivityState): Promise<void> {
    await this.ctx.storage.put("activity_state", activity);
  }

  private getMembers(excludeWs?: WebSocket): Member[] {
    const members: Member[] = [];
    for (const ws of this.ctx.getWebSockets()) {
      if (excludeWs && ws === excludeWs) continue;
      const att = ws.deserializeAttachment() as SocketAttachment | null;
      if (att && att.nickname) {
        members.push({
          id: att.id,
          clientId: att.clientId,
          nickname: att.nickname,
          avatar: att.avatar,
          color: att.color,
          seat: att.seat,
          ready: att.ready,
        });
      }
    }
    return members;
  }

  private broadcast(msg: ServerMessage, excludeWs?: WebSocket): void {
    const raw = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) {
      if (excludeWs && ws === excludeWs) continue;
      try {
        ws.send(raw);
      } catch {
        // Socket might be disconnected or erroring
      }
    }
  }

  private emitActivity(text: string, actorId?: string): void {
    this.broadcast({
      type: "activity",
      text,
      time: Date.now(),
      actorId,
    });
  }

  private schedulePopcornFlush(): void {
    if (this.popcornFlushTimeoutId) return;
    this.popcornFlushTimeoutId = setTimeout(async () => {
      this.popcornFlushTimeoutId = null;
      if (this.popcornPending > 0) {
        const meta = await this.getRoomMeta();
        meta.popcorn += this.popcornPending;
        this.popcornPending = 0;
        await this.saveRoomMeta(meta);
        this.broadcast({ type: "meta", ...meta });
      }
    }, 4000);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/init") {
      const isCreated = (await this.ctx.storage.get<boolean>("is_created")) || false;
      if (isCreated) {
        return new Response(JSON.stringify({ created: false, reason: "collision" }), {
          status: 409,
          headers: { "Content-Type": "application/json" },
        });
      }
      await this.ctx.storage.put("is_created", true);
      await this.ctx.storage.put("created_at", Date.now());
      return new Response(JSON.stringify({ created: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.pathname === "/check") {
      const isCreated = (await this.ctx.storage.get<boolean>("is_created")) || false;
      return new Response(JSON.stringify({ exists: isCreated }), {
        status: isCreated ? 200 : 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.pathname === "/ws") {
      const isCreated = (await this.ctx.storage.get<boolean>("is_created")) || false;
      if (!isCreated) {
        return new Response(
          JSON.stringify({ error: "Room does not exist" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }

      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("Expected WebSocket Upgrade", { status: 426 });
      }

      const webSocketPair = new WebSocketPair();
      const [client, server] = Object.values(webSocketPair);

      // WebSocket Hibernation API
      this.ctx.acceptWebSocket(server);

      const now = Date.now();
      const initialAttachment: SocketAttachment = {
        id: crypto.randomUUID(),
        clientId: "",
        nickname: "",
        avatar: "🍿",
        color: "#6366f1",
        seat: null,
        ready: false,
        chatWindowStart: now,
        chatCount: 0,
        reactionWindowStart: now,
        reactionCount: 0,
        emoteWindowStart: now,
        emoteCount: 0,
        typingWindowStart: now,
        typingCount: 0,
        popcornWindowStart: now,
        popcornCount: 0,
        drawWindowStart: now,
        drawCount: 0,
        queueWindowStart: now,
        queueCount: 0,
      };
      server.serializeAttachment(initialAttachment);

      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }

    return new Response("Not found in RoomDO", { status: 404 });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    try {
      const rawText = typeof message === "string" ? message : new TextDecoder().decode(message);
      const data = JSON.parse(rawText) as ClientMessage;

      if (data.type === "ping") {
        ws.send(JSON.stringify({
          type: "pong",
          serverTime: Date.now(),
        }));
        return;
      }

      // 1. JOIN
      if (data.type === "join") {
        const clientId = typeof data.clientId === "string" && data.clientId.trim()
          ? data.clientId.trim()
          : crypto.randomUUID();

        let rawNickname = typeof data.nickname === "string" ? data.nickname.trim() : "";
        if (!rawNickname) {
          rawNickname = generatePokemonNickname();
        } else if (rawNickname.length < MIN_NICKNAME_LENGTH || rawNickname.length > MAX_NICKNAME_LENGTH) {
          ws.send(JSON.stringify({
            type: "error",
            message: `Nickname must be between ${MIN_NICKNAME_LENGTH} and ${MAX_NICKNAME_LENGTH} characters.`,
          }));
          return;
        }

        const defaults = pickDefaultAvatar(clientId);
        const avatar = (data.avatar && (AVATAR_EMOJIS as readonly string[]).includes(data.avatar))
          ? data.avatar
          : defaults.avatar;
        const color = (data.color && (AVATAR_COLORS as readonly string[]).includes(data.color))
          ? data.color
          : defaults.color;

        // Check if there is an existing live socket for this clientId
        let inheritedSeat: number | null = null;
        let wasReplaced = false;

        for (const otherWs of this.ctx.getWebSockets()) {
          if (otherWs === ws) continue;
          const otherAtt = otherWs.deserializeAttachment() as SocketAttachment | null;
          if (otherAtt && otherAtt.clientId === clientId) {
            inheritedSeat = otherAtt.seat;
            wasReplaced = true;
            otherAtt.isReplaced = true;
            otherWs.serializeAttachment(otherAtt);
            try {
              otherWs.close(4000, "replaced");
            } catch {}
          }
        }

        // Assign seat: inherited or lowest available seat
        let assignedSeat = inheritedSeat;
        if (assignedSeat === null) {
          const takenSeats = new Set<number>();
          for (const s of this.ctx.getWebSockets()) {
            if (s === ws) continue;
            const a = s.deserializeAttachment() as SocketAttachment | null;
            if (a && a.seat !== null && a.seat !== undefined) {
              takenSeats.add(a.seat);
            }
          }
          for (let i = 0; i < SEAT_COUNT; i++) {
            if (!takenSeats.has(i)) {
              assignedSeat = i;
              break;
            }
          }
        }

        const now = Date.now();
        const att: SocketAttachment = {
          id: crypto.randomUUID(),
          clientId,
          nickname: rawNickname,
          avatar,
          color,
          seat: assignedSeat,
          ready: false,
          chatWindowStart: now,
          chatCount: 0,
          reactionWindowStart: now,
          reactionCount: 0,
          emoteWindowStart: now,
          emoteCount: 0,
          typingWindowStart: now,
          typingCount: 0,
          popcornWindowStart: now,
          popcornCount: 0,
          drawWindowStart: now,
          drawCount: 0,
          queueWindowStart: now,
          queueCount: 0,
        };
        ws.serializeAttachment(att);

        const currentMember: Member = {
          id: att.id,
          clientId: att.clientId,
          nickname: att.nickname,
          avatar: att.avatar,
          color: att.color,
          seat: att.seat,
          ready: att.ready,
        };

        // Welcome message with selfId
        ws.send(JSON.stringify({
          type: "welcome",
          selfId: att.id,
          member: currentMember,
        }));

        // Initial room synchronization
        const roomState = await this.getRoomState();
        const history = await this.getChatHistory();
        const queueItems = await this.getQueue();
        const meta = await this.getRoomMeta();
        const activityState = await this.getActivityState();
        const members = this.getMembers();

        ws.send(JSON.stringify({
          type: "state",
          videoId: roomState.videoId,
          mediaType: roomState.mediaType,
          isPlaying: roomState.isPlaying,
          positionSec: roomState.positionSec,
          updatedAt: roomState.updatedAt,
          serverTime: Date.now(),
        }));

        ws.send(JSON.stringify({
          type: "members",
          members,
        }));

        ws.send(JSON.stringify({
          type: "history",
          messages: history,
        }));

        ws.send(JSON.stringify({
          type: "queue",
          items: queueItems,
        }));

        ws.send(JSON.stringify({
          type: "meta",
          ...meta,
        }));

        ws.send(JSON.stringify({
          type: "activityState",
          activity: activityState,
        }));

        if (this.readyCheckState.phase !== "idle") {
          ws.send(JSON.stringify({
            type: "readyCheck",
            ...this.readyCheckState,
          }));
        }

        // Broadcast updated members list to other sockets
        this.broadcast({
          type: "members",
          members,
        }, ws);

        if (!wasReplaced) {
          const joinChatMsg: ChatMessage = {
            id: crypto.randomUUID(),
            nickname: "System",
            text: `${rawNickname} joined`,
            time: Date.now(),
            isSystem: true,
          };
          await this.addChatMessage(joinChatMsg);
          this.broadcast({
            type: "chat",
            nickname: joinChatMsg.nickname,
            text: joinChatMsg.text,
            time: joinChatMsg.time,
            isSystem: true,
          });
          this.emitActivity(`${rawNickname} joined the lounge`, att.id);
        }
        return;
      }

      const att = ws.deserializeAttachment() as SocketAttachment | null;
      if (!att || !att.nickname) {
        ws.send(JSON.stringify({ type: "error", message: "You must join before sending commands." }));
        return;
      }

      // 2. CHAT
      if (data.type === "chat") {
        const text = typeof data.text === "string" ? data.text.trim() : "";
        if (text.length === 0) return;
        if (text.length > MAX_CHAT_TEXT_LENGTH) {
          ws.send(JSON.stringify({
            type: "error",
            message: `Message too long (max ${MAX_CHAT_TEXT_LENGTH} characters).`,
          }));
          return;
        }

        const now = Date.now();
        if (now - att.chatWindowStart > CHAT_RATE_LIMIT_WINDOW_MS) {
          att.chatWindowStart = now;
          att.chatCount = 0;
        }
        if (att.chatCount >= CHAT_RATE_LIMIT_COUNT) {
          ws.send(JSON.stringify({
            type: "error",
            message: "You are chatting too fast. Please wait a few seconds.",
          }));
          return;
        }

        att.chatCount += 1;
        ws.serializeAttachment(att);

        const chatMsg: ChatMessage = {
          id: crypto.randomUUID(),
          nickname: att.nickname,
          text,
          time: now,
          isSystem: false,
        };
        await this.addChatMessage(chatMsg);
        this.broadcast({
          type: "chat",
          nickname: chatMsg.nickname,
          text: chatMsg.text,
          time: chatMsg.time,
          isSystem: false,
        });
        return;
      }

      // 3. SEATING (Sit / Stand)
      if (data.type === "sit") {
        const seat = Number(data.seat);
        if (isNaN(seat) || seat < 0 || seat >= SEAT_COUNT) {
          ws.send(JSON.stringify({ type: "error", message: "Invalid seat number." }));
          return;
        }

        // Check if seat occupied by another live socket
        for (const otherWs of this.ctx.getWebSockets()) {
          if (otherWs === ws) continue;
          const otherAtt = otherWs.deserializeAttachment() as SocketAttachment | null;
          if (otherAtt && otherAtt.seat === seat) {
            ws.send(JSON.stringify({ type: "error", message: "That seat is already taken." }));
            return;
          }
        }

        att.seat = seat;
        ws.serializeAttachment(att);

        const members = this.getMembers();
        this.broadcast({ type: "members", members });
        return;
      }

      if (data.type === "stand") {
        att.seat = null;
        ws.serializeAttachment(att);
        const members = this.getMembers();
        this.broadcast({ type: "members", members });
        return;
      }

      // 4. FLOATING REACTIONS
      if (data.type === "reaction") {
        const emoji = data.emoji;
        if (!REACTION_EMOJIS.includes(emoji as any)) return;

        const now = Date.now();
        if (now - att.reactionWindowStart > REACTION_RATE_LIMIT_WINDOW_MS) {
          att.reactionWindowStart = now;
          att.reactionCount = 0;
        }
        if (att.reactionCount >= REACTION_RATE_LIMIT_COUNT) return;
        att.reactionCount += 1;
        ws.serializeAttachment(att);

        const x = Math.random(); // lane 0..1
        this.broadcast({
          type: "reaction",
          fromId: att.id,
          emoji,
          x,
        });
        return;
      }

      // 5. EMOTES & NUDGES
      if (data.type === "emote") {
        const kind = data.kind;
        if (!EMOTES.includes(kind as any)) return;

        const now = Date.now();
        if (now - att.emoteWindowStart > EMOTE_RATE_LIMIT_WINDOW_MS) {
          att.emoteWindowStart = now;
          att.emoteCount = 0;
        }
        if (att.emoteCount >= EMOTE_RATE_LIMIT_COUNT) return;
        att.emoteCount += 1;
        ws.serializeAttachment(att);

        let targetName: string | undefined;
        if (data.targetId) {
          for (const s of this.ctx.getWebSockets()) {
            const a = s.deserializeAttachment() as SocketAttachment | null;
            if (a && a.id === data.targetId) {
              targetName = a.nickname;
              break;
            }
          }
        }

        this.broadcast({
          type: "emote",
          fromId: att.id,
          kind,
          targetId: data.targetId,
          fromName: att.nickname,
          targetName,
        });

        const emoteDesc =
          kind === "wave" ? (targetName ? `waved to ${targetName}` : "waved to the lounge") :
          kind === "popcorn" ? (targetName ? `passed popcorn to ${targetName}` : "shared popcorn") :
          kind === "highfive" ? (targetName ? `high-fived ${targetName}` : "offered a high-five") :
          kind === "dance" ? "started dancing!" :
          kind === "shush" ? (targetName ? `shushed ${targetName}` : "shushed the room") : "reacted";

        this.emitActivity(`${att.nickname} ${emoteDesc}`, att.id);
        return;
      }

      // 6. TYPING INDICATOR
      if (data.type === "typing") {
        const now = Date.now();
        if (now - att.typingWindowStart > TYPING_RATE_LIMIT_WINDOW_MS) {
          att.typingWindowStart = now;
          att.typingCount = 0;
        }
        if (att.typingCount >= TYPING_RATE_LIMIT_COUNT) return;
        att.typingCount += 1;
        ws.serializeAttachment(att);

        this.broadcast({
          type: "typing",
          id: att.id,
          isTyping: !!data.isTyping,
          nickname: att.nickname,
        }, ws);
        return;
      }

      // 7. READY CHECK & COUNTDOWN
      if (data.type === "readyCheckStart") {
        if (this.readyCheckState.phase !== "idle") return;

        // Reset ready status across all sockets
        for (const s of this.ctx.getWebSockets()) {
          const a = s.deserializeAttachment() as SocketAttachment | null;
          if (a) {
            a.ready = a.id === att.id;
            s.serializeAttachment(a);
          }
        }

        this.readyCheckState = {
          phase: "checking",
          readyIds: [att.id],
        };

        this.broadcast({
          type: "readyCheck",
          ...this.readyCheckState,
        });

        this.emitActivity(`${att.nickname} started a ready check`, att.id);

        if (this.readyCheckTimeoutId) clearTimeout(this.readyCheckTimeoutId);
        this.readyCheckTimeoutId = setTimeout(() => {
          if (this.readyCheckState.phase === "checking") {
            this.readyCheckState = { phase: "idle", readyIds: [] };
            this.broadcast({ type: "readyCheck", ...this.readyCheckState });
            this.emitActivity("Ready check timed out");
          }
        }, 60000);
        return;
      }

      if (data.type === "ready") {
        if (this.readyCheckState.phase !== "checking") return;

        att.ready = !!data.ready;
        ws.serializeAttachment(att);

        const currentReadyIds = new Set(this.readyCheckState.readyIds);
        if (att.ready) {
          currentReadyIds.add(att.id);
        } else {
          currentReadyIds.delete(att.id);
        }
        this.readyCheckState.readyIds = Array.from(currentReadyIds);

        const allSockets = this.ctx.getWebSockets();
        const activeSockets = allSockets.filter(s => {
          const a = s.deserializeAttachment() as SocketAttachment | null;
          return a && a.nickname;
        });

        const allReady = activeSockets.length > 0 && activeSockets.every(s => {
          const a = s.deserializeAttachment() as SocketAttachment | null;
          return a && a.ready;
        });

        if (allReady) {
          if (this.readyCheckTimeoutId) clearTimeout(this.readyCheckTimeoutId);
          const startAt = Date.now() + 3000; // 3-second countdown
          this.readyCheckState = {
            phase: "countdown",
            readyIds: this.readyCheckState.readyIds,
            startAt,
          };
          this.broadcast({ type: "readyCheck", ...this.readyCheckState });
          this.emitActivity("Everyone is ready! Starting playback...");

          // Set room state to play starting at startAt
          const rState = await this.getRoomState();
          rState.isPlaying = true;
          rState.updatedAt = startAt;
          await this.ctx.storage.put("room_state", rState);

          this.broadcast({
            type: "state",
            videoId: rState.videoId,
            mediaType: rState.mediaType,
            isPlaying: rState.isPlaying,
            positionSec: rState.positionSec,
            updatedAt: rState.updatedAt,
            serverTime: Date.now(),
          });

          setTimeout(() => {
            this.readyCheckState = { phase: "idle", readyIds: [] };
            this.broadcast({ type: "readyCheck", ...this.readyCheckState });
          }, 4000);
        } else {
          this.broadcast({ type: "readyCheck", ...this.readyCheckState });
        }
        return;
      }

      if (data.type === "readyCheckCancel") {
        if (this.readyCheckState.phase === "idle") return;
        if (this.readyCheckTimeoutId) clearTimeout(this.readyCheckTimeoutId);
        this.readyCheckState = { phase: "idle", readyIds: [] };
        this.broadcast({ type: "readyCheck", ...this.readyCheckState });
        this.emitActivity(`${att.nickname} cancelled the ready check`, att.id);
        return;
      }

      // 8. QUEUE MANAGEMENT
      if (data.type === "queueAdd") {
        const rawUrl = typeof data.url === "string" ? data.url.trim() : "";
        const parsedMedia = parseMediaUrl(rawUrl);
        if (!parsedMedia) {
          ws.send(JSON.stringify({ type: "error", message: "Unsupported video or stream URL format." }));
          return;
        }

        const queue = await this.getQueue();
        if (queue.length >= MAX_QUEUE_ITEMS) {
          ws.send(JSON.stringify({ type: "error", message: `Queue is full (max ${MAX_QUEUE_ITEMS} items).` }));
          return;
        }

        const newItem: QueueItem = {
          id: crypto.randomUUID(),
          videoId: parsedMedia.videoId,
          mediaType: parsedMedia.mediaType,
          title: rawUrl.length > 60 ? rawUrl.slice(0, 60) + "..." : rawUrl,
          addedBy: att.clientId,
          addedByNickname: att.nickname,
          voters: [att.clientId],
        };

        queue.push(newItem);
        // Sort descending by votes
        queue.sort((a, b) => b.voters.length - a.voters.length);
        await this.saveQueue(queue);
        this.broadcast({ type: "queue", items: queue });
        this.emitActivity(`${att.nickname} added a video to the queue`, att.id);
        return;
      }

      if (data.type === "queueVote") {
        const queue = await this.getQueue();
        const item = queue.find(q => q.id === data.itemId);
        if (!item) return;

        const voterIdx = item.voters.indexOf(att.clientId);
        if (voterIdx >= 0) {
          item.voters.splice(voterIdx, 1);
        } else {
          item.voters.push(att.clientId);
        }

        queue.sort((a, b) => b.voters.length - a.voters.length);
        await this.saveQueue(queue);
        this.broadcast({ type: "queue", items: queue });
        return;
      }

      if (data.type === "queueRemove") {
        const queue = await this.getQueue();
        const itemIndex = queue.findIndex(q => q.id === data.itemId);
        if (itemIndex >= 0) {
          const item = queue[itemIndex];
          if (item.addedBy === att.clientId) {
            queue.splice(itemIndex, 1);
            await this.saveQueue(queue);
            this.broadcast({ type: "queue", items: queue });
          }
        }
        return;
      }

      if (data.type === "queuePlayNext" || data.type === "videoEnded") {
        const now = Date.now();
        if (data.type === "videoEnded") {
          const rState = await this.getRoomState();
          if (data.videoId !== rState.videoId || now - this.lastAutoAdvanceTime < 5000) {
            return;
          }
          this.lastAutoAdvanceTime = now;
        }

        const queue = await this.getQueue();
        if (queue.length === 0) return;

        const nextItem = queue.shift()!;
        await this.saveQueue(queue);
        this.broadcast({ type: "queue", items: queue });

        const rState: RoomState = {
          videoId: nextItem.videoId,
          mediaType: nextItem.mediaType,
          isPlaying: true,
          positionSec: 0,
          updatedAt: Date.now(),
        };
        await this.ctx.storage.put("room_state", rState);

        this.broadcast({
          type: "state",
          videoId: rState.videoId,
          mediaType: rState.mediaType,
          isPlaying: rState.isPlaying,
          positionSec: rState.positionSec,
          updatedAt: rState.updatedAt,
          serverTime: Date.now(),
        });
        this.emitActivity(`Playing next: ${nextItem.title || nextItem.videoId}`, att.id);
        return;
      }

      // 9. VIDEO PLAYBACK CONTROL (setVideo, play, pause, seek)
      if (data.type === "setVideo") {
        const rawUrl = typeof data.videoId === "string" ? data.videoId.trim() : "";
        const parsedMedia = parseMediaUrl(rawUrl);
        if (!parsedMedia) {
          ws.send(JSON.stringify({ type: "error", message: "Unsupported video or website link format." }));
          return;
        }

        const newRoomState: RoomState = {
          videoId: parsedMedia.videoId,
          mediaType: parsedMedia.mediaType,
          isPlaying: false,
          positionSec: 0,
          updatedAt: Date.now(),
        };
        await this.ctx.storage.put("room_state", newRoomState);

        this.broadcast({
          type: "state",
          videoId: newRoomState.videoId,
          mediaType: newRoomState.mediaType,
          isPlaying: newRoomState.isPlaying,
          positionSec: newRoomState.positionSec,
          updatedAt: newRoomState.updatedAt,
          serverTime: Date.now(),
        });
        this.emitActivity(`${att.nickname} loaded a new video`, att.id);
        return;
      }

      if (data.type === "play") {
        const pos = typeof data.positionSec === "number" && !isNaN(data.positionSec) ? Math.max(0, data.positionSec) : 0;
        const cur = await this.getRoomState();
        cur.isPlaying = true;
        cur.positionSec = pos;
        cur.updatedAt = Date.now();
        await this.ctx.storage.put("room_state", cur);

        this.broadcast({
          type: "state",
          videoId: cur.videoId,
          mediaType: cur.mediaType,
          isPlaying: cur.isPlaying,
          positionSec: cur.positionSec,
          updatedAt: cur.updatedAt,
          serverTime: Date.now(),
        });

        const mins = Math.floor(pos / 60);
        const secs = Math.floor(pos % 60).toString().padStart(2, "0");
        this.emitActivity(`${att.nickname} played at ${mins}:${secs}`, att.id);
        return;
      }

      if (data.type === "pause") {
        const pos = typeof data.positionSec === "number" && !isNaN(data.positionSec) ? Math.max(0, data.positionSec) : 0;
        const cur = await this.getRoomState();
        cur.isPlaying = false;
        cur.positionSec = pos;
        cur.updatedAt = Date.now();
        await this.ctx.storage.put("room_state", cur);

        this.broadcast({
          type: "state",
          videoId: cur.videoId,
          mediaType: cur.mediaType,
          isPlaying: cur.isPlaying,
          positionSec: cur.positionSec,
          updatedAt: cur.updatedAt,
          serverTime: Date.now(),
        });

        const mins = Math.floor(pos / 60);
        const secs = Math.floor(pos % 60).toString().padStart(2, "0");
        this.emitActivity(`${att.nickname} paused at ${mins}:${secs}`, att.id);
        return;
      }

      if (data.type === "seek") {
        const pos = typeof data.positionSec === "number" && !isNaN(data.positionSec) ? Math.max(0, data.positionSec) : 0;
        const cur = await this.getRoomState();
        cur.positionSec = pos;
        cur.updatedAt = Date.now();
        await this.ctx.storage.put("room_state", cur);

        this.broadcast({
          type: "state",
          videoId: cur.videoId,
          mediaType: cur.mediaType,
          isPlaying: cur.isPlaying,
          positionSec: cur.positionSec,
          updatedAt: cur.updatedAt,
          serverTime: Date.now(),
        });

        const mins = Math.floor(pos / 60);
        const secs = Math.floor(pos % 60).toString().padStart(2, "0");
        this.emitActivity(`${att.nickname} jumped to ${mins}:${secs}`, att.id);
        return;
      }

      // 10. ROOM META & POPCORN
      if (data.type === "setRoomMeta") {
        const meta = await this.getRoomMeta();
        if (typeof data.name === "string") {
          meta.name = data.name.trim().slice(0, MAX_ROOM_NAME_LENGTH) || "Hangout Lounge";
        }
        if (data.theme && (THEMES as readonly string[]).includes(data.theme)) {
          meta.theme = data.theme;
        }
        if (data.voiceUrl !== undefined) {
          if (!data.voiceUrl) {
            meta.voiceUrl = null;
          } else if (data.voiceUrl.startsWith("https://")) {
            meta.voiceUrl = data.voiceUrl.trim();
          }
        }
        await this.saveRoomMeta(meta);
        this.broadcast({ type: "meta", ...meta });
        this.emitActivity(`${att.nickname} updated room settings`, att.id);
        return;
      }

      if (data.type === "popcorn") {
        const now = Date.now();
        if (now - att.popcornWindowStart > POPCORN_RATE_LIMIT_WINDOW_MS) {
          att.popcornWindowStart = now;
          att.popcornCount = 0;
        }
        if (att.popcornCount >= POPCORN_RATE_LIMIT_COUNT) return;
        att.popcornCount += 1;
        ws.serializeAttachment(att);

        this.popcornPending += 1;
        this.schedulePopcornFlush();
        return;
      }

      // 11. ACTIVITIES (Polls, Tic-Tac-Toe, Drawing)
      if (data.type === "setActivity") {
        let actState = await this.getActivityState();
        actState.type = data.activityType;
        if (data.activityType === "tictactoe" && !actState.tictactoe) {
          actState.tictactoe = createInitialTicTacToe();
        }
        await this.saveActivityState(actState);
        this.broadcast({ type: "activityState", activity: actState });
        return;
      }

      if (data.type === "pollCreate") {
        const poll = createPoll(crypto.randomUUID(), data.question, data.options, att.clientId);
        const actState: ActivityState = {
          type: "poll",
          poll,
        };
        await this.saveActivityState(actState);
        this.broadcast({ type: "activityState", activity: actState });
        this.emitActivity(`${att.nickname} started a poll: "${poll.question}"`, att.id);
        return;
      }

      if (data.type === "pollVote") {
        const actState = await this.getActivityState();
        if (actState.type === "poll" && actState.poll && !actState.poll.closed) {
          const optIdx = Number(data.optionIndex);
          if (optIdx >= 0 && optIdx < actState.poll.options.length) {
            actState.poll.votes[att.clientId] = optIdx;
            await this.saveActivityState(actState);
            this.broadcast({ type: "activityState", activity: actState });
          }
        }
        return;
      }

      if (data.type === "pollClose") {
        const actState = await this.getActivityState();
        if (actState.type === "poll" && actState.poll) {
          actState.poll.closed = true;
          await this.saveActivityState(actState);
          this.broadcast({ type: "activityState", activity: actState });
          this.emitActivity(`${att.nickname} closed the poll`);
        }
        return;
      }

      if (data.type === "tttJoin") {
        const actState = await this.getActivityState();
        if (!actState.tictactoe) actState.tictactoe = createInitialTicTacToe();
        const side = data.side;
        if (side === "X" || side === "O") {
          if (!actState.tictactoe.players[side]) {
            actState.tictactoe.players[side] = att.clientId;
            if (side === "X") actState.tictactoe.players.XName = att.nickname;
            if (side === "O") actState.tictactoe.players.OName = att.nickname;
            await this.saveActivityState(actState);
            this.broadcast({ type: "activityState", activity: actState });
            this.emitActivity(`${att.nickname} joined Tic-Tac-Toe as ${side}`);
          }
        }
        return;
      }

      if (data.type === "tttMove") {
        const actState = await this.getActivityState();
        const ttt = actState.tictactoe;
        if (ttt && !ttt.winner) {
          const side = ttt.turn;
          if (ttt.players[side] === att.clientId) {
            const idx = Number(data.index);
            if (idx >= 0 && idx < 9 && ttt.board[idx] === null) {
              ttt.board[idx] = side;
              const winner = checkTicTacToeWinner(ttt.board);
              if (winner) {
                ttt.winner = winner;
                this.emitActivity(
                  winner === "draw" ? "Tic-Tac-Toe ended in a draw!" : `Tic-Tac-Toe: ${winner} won!`
                );
              } else {
                ttt.turn = side === "X" ? "O" : "X";
              }
              await this.saveActivityState(actState);
              this.broadcast({ type: "activityState", activity: actState });
            }
          }
        }
        return;
      }

      if (data.type === "tttReset") {
        const actState = await this.getActivityState();
        actState.tictactoe = createInitialTicTacToe();
        await this.saveActivityState(actState);
        this.broadcast({ type: "activityState", activity: actState });
        return;
      }

      if (data.type === "drawStroke") {
        const now = Date.now();
        if (now - att.drawWindowStart > DRAW_RATE_LIMIT_WINDOW_MS) {
          att.drawWindowStart = now;
          att.drawCount = 0;
        }
        if (att.drawCount >= DRAW_RATE_LIMIT_COUNT) return;
        att.drawCount += 1;
        ws.serializeAttachment(att);

        // Ephemeral broadcast only
        this.broadcast({
          type: "drawStroke",
          stroke: data.stroke,
        }, ws);
        return;
      }

      if (data.type === "drawClear") {
        this.broadcast({ type: "drawClear" });
        return;
      }

    } catch (err: unknown) {
      console.error("Error processing websocket message:", err);
      const errorMsg: ServerMessage = {
        type: "error",
        message: err instanceof Error ? err.message : "Malformed message",
      };
      ws.send(JSON.stringify(errorMsg));
    }
  }

  async webSocketClose(ws: WebSocket, code: number, _reason: string, _wasClean: boolean): Promise<void> {
    try {
      const att = ws.deserializeAttachment() as SocketAttachment | null;
      if (att && att.nickname) {
        const remainingMembers = this.getMembers(ws);

        // Broadcast updated members list
        this.broadcast({
          type: "members",
          members: remainingMembers,
        }, ws);

        // If replaced, skip leave line and preserve seat inheritance
        if (!att.isReplaced && code !== 4000) {
          const leaveMsg: ChatMessage = {
            id: crypto.randomUUID(),
            nickname: "System",
            text: `${att.nickname} left`,
            time: Date.now(),
            isSystem: true,
          };
          await this.addChatMessage(leaveMsg);
          this.broadcast({
            type: "chat",
            nickname: leaveMsg.nickname,
            text: leaveMsg.text,
            time: leaveMsg.time,
            isSystem: true,
          }, ws);
          this.emitActivity(`${att.nickname} left the room`);
        }
      }
    } catch (err) {
      console.error("Error during webSocketClose handling:", err);
    }
  }

  async webSocketError(ws: WebSocket, _error: unknown): Promise<void> {
    try {
      ws.close(1011, "Internal error");
    } catch {
      // Ignore
    }
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);

      // Handle CORS preflight
      if (request.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: CORS_HEADERS,
        });
      }

      // GET /api/proxy?url=<target> -> Mini Browser proxy gateway
      if (request.method === "GET" && url.pathname === "/api/proxy") {
        const targetUrl = url.searchParams.get("url");
        if (!targetUrl) {
          return new Response(JSON.stringify({ error: "Missing url parameter" }), {
            status: 400,
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          });
        }

        // SSRF check
        const ssrfCheck = isBlockedUrl(targetUrl);
        if (ssrfCheck.blocked) {
          return new Response(JSON.stringify({ error: `Proxy blocked: ${ssrfCheck.reason}` }), {
            status: 403,
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          });
        }

        try {
          const parsedTarget = new URL(targetUrl);

          const fetchHeaders = new Headers();
          const range = request.headers.get("range");
          if (range) fetchHeaders.set("range", range);
          fetchHeaders.set(
            "User-Agent",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
          );
          fetchHeaders.set("Accept", request.headers.get("accept") || "*/*");

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 12000);

          const targetRes = await fetch(targetUrl, {
            headers: fetchHeaders,
            redirect: "follow",
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          const responseHeaders = new Headers(targetRes.headers);
          responseHeaders.delete("x-frame-options");
          responseHeaders.delete("content-security-policy");
          responseHeaders.delete("content-security-policy-report-only");
          responseHeaders.delete("cross-origin-resource-policy");
          responseHeaders.delete("cross-origin-opener-policy");
          responseHeaders.delete("cross-origin-embedder-policy");
          responseHeaders.set("Access-Control-Allow-Origin", "*");
          responseHeaders.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");

          const contentType = targetRes.headers.get("content-type") || "";
          if (contentType.includes("text/html")) {
            let html = await targetRes.text();
            responseHeaders.delete("content-encoding");
            responseHeaders.delete("content-length");

            responseHeaders.append(
              "Set-Cookie",
              `__wp_proxy_origin=${encodeURIComponent(parsedTarget.origin)}; Path=/; SameSite=Lax`
            );

            const targetPath = parsedTarget.pathname + parsedTarget.search;
            const initScript = `<base href="${targetRes.url || targetUrl}"><script>try{window.__WP_ORIGINAL_URL="${targetUrl}";if(window.location.pathname==="/api/proxy"){window.history.replaceState(null,"","${targetPath}");}}catch(e){}</script>`;

            if (html.includes("<head>")) {
              html = html.replace("<head>", `<head>${initScript}`);
            } else if (html.includes("<HEAD>")) {
              html = html.replace("<HEAD>", `<HEAD>${initScript}`);
            } else {
              html = initScript + html;
            }
            return new Response(html, {
              status: targetRes.status,
              headers: responseHeaders,
            });
          }

          return new Response(targetRes.body, {
            status: targetRes.status,
            headers: responseHeaders,
          });
        } catch (err: unknown) {
          return new Response(
            JSON.stringify({ error: err instanceof Error ? err.message : "Proxy fetch failed" }),
            {
              status: 502,
              headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
            }
          );
        }
      }

      // POST /api/rooms -> create a room and return { code }
      if (request.method === "POST" && url.pathname === "/api/rooms") {
        let code = "";
        let attempts = 0;
        let created = false;

        while (!created && attempts < 5) {
          attempts++;
          code = generateRoomCode();
          const id = env.ROOM_DO.idFromName(code);
          const stub = env.ROOM_DO.get(id);

          const initRes = await stub.fetch("http://internal/init", { method: "POST" });
          if (initRes.status === 200) {
            created = true;
            break;
          }
        }

        if (!created) {
          return new Response(JSON.stringify({ error: "Failed to generate unique room code" }), {
            status: 500,
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ code }), {
          status: 200,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      // GET /api/rooms/:code/ws -> WebSocket upgrade
      const wsMatch = url.pathname.match(/^\/api\/rooms\/([^/]+)\/ws$/);
      if (wsMatch) {
        const rawCode = sanitizeRoomCode(decodeURIComponent(wsMatch[1]));
        if (!isValidRoomCode(rawCode)) {
          return new Response(JSON.stringify({ error: "Invalid room code format" }), {
            status: 400,
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          });
        }

        const id = env.ROOM_DO.idFromName(rawCode);
        const stub = env.ROOM_DO.get(id);

        const doUrl = new URL(request.url);
        doUrl.pathname = "/ws";
        return stub.fetch(new Request(doUrl.toString(), request));
      }

      // Reverse-proxy subresource fallback (e.g. /_app/..., /_next/..., /assets/...)
      let targetOrigin: string | null = null;
      const cookieHeader = request.headers.get("cookie") || "";
      const cookieMatch = cookieHeader.match(/__wp_proxy_origin=([^;]+)/);
      if (cookieMatch) {
        try {
          targetOrigin = decodeURIComponent(cookieMatch[1]);
        } catch {}
      }

      const referer = request.headers.get("referer");
      if (!targetOrigin && referer && referer.includes("/api/proxy?url=")) {
        try {
          const refUrl = new URL(referer);
          const origTarget = refUrl.searchParams.get("url");
          if (origTarget) {
            targetOrigin = new URL(origTarget).origin;
          }
        } catch {}
      }

      if (targetOrigin) {
        try {
          const subResourceUrl = `${targetOrigin}${url.pathname}${url.search}`;
          const ssrfCheck = isBlockedUrl(subResourceUrl);
          if (ssrfCheck.blocked) {
            return new Response(JSON.stringify({ error: `Subresource blocked: ${ssrfCheck.reason}` }), {
              status: 403,
              headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
            });
          }

          const subHeaders = new Headers();
          const range = request.headers.get("range");
          if (range) subHeaders.set("range", range);
          subHeaders.set(
            "User-Agent",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
          );
          subHeaders.set("Accept", request.headers.get("accept") || "*/*");

          const subRes = await fetch(subResourceUrl, {
            headers: subHeaders,
            redirect: "follow",
          });

          const subResHeaders = new Headers(subRes.headers);
          subResHeaders.set("Access-Control-Allow-Origin", "*");
          subResHeaders.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
          subResHeaders.delete("x-frame-options");
          subResHeaders.delete("content-security-policy");
          subResHeaders.delete("cross-origin-resource-policy");

          return new Response(subRes.body, {
            status: subRes.status,
            headers: subResHeaders,
          });
        } catch (e) {
          console.error("Subresource proxy fallback error:", e);
        }
      }

      // Anything else returns 404
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    } catch (err: unknown) {
      console.error("Worker fetch unhandled error:", err);
      return new Response(
        JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
        {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }
  },
};
