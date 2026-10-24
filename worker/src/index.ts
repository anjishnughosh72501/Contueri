import { DurableObject } from "cloudflare:workers";
import {
  ClientMessage,
  ServerMessage,
  RoomState,
  ChatMessage,
  generateRoomCode,
  isValidRoomCode,
  MIN_NICKNAME_LENGTH,
  MAX_NICKNAME_LENGTH,
  MAX_CHAT_TEXT_LENGTH,
  MAX_CHAT_HISTORY,
  CHAT_RATE_LIMIT_COUNT,
  CHAT_RATE_LIMIT_WINDOW_MS,
  parseMediaUrl,
  generatePokemonNickname,
  sanitizeRoomCode,
} from "@contueri/shared";

export interface Env {
  ROOM_DO: DurableObjectNamespace<RoomDO>;
}

interface SocketAttachment {
  id: string;
  nickname: string;
  joinedAt: number;
  chatWindowStart: number;
  chatCount: number;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export class RoomDO extends DurableObject<Env> {
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

  private getMembers(excludeWs?: WebSocket): string[] {
    const members: string[] = [];
    for (const ws of this.ctx.getWebSockets()) {
      if (excludeWs && ws === excludeWs) continue;
      const att = ws.deserializeAttachment() as SocketAttachment | null;
      if (att && att.nickname) {
        members.push(att.nickname);
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

      const initialAttachment: SocketAttachment = {
        id: crypto.randomUUID(),
        nickname: "",
        joinedAt: Date.now(),
        chatWindowStart: Date.now(),
        chatCount: 0,
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
        const pongMessage: ServerMessage = {
          type: "pong",
          serverTime: Date.now(),
        };
        ws.send(JSON.stringify(pongMessage));
        return;
      }

      if (data.type === "join") {
        let rawNickname = typeof data.nickname === "string" ? data.nickname.trim() : "";
        if (!rawNickname) {
          rawNickname = generatePokemonNickname();
        } else if (rawNickname.length < MIN_NICKNAME_LENGTH || rawNickname.length > MAX_NICKNAME_LENGTH) {
          const errMsg: ServerMessage = {
            type: "error",
            message: `Nickname must be between ${MIN_NICKNAME_LENGTH} and ${MAX_NICKNAME_LENGTH} characters.`,
          };
          ws.send(JSON.stringify(errMsg));
          return;
        }

        const currentAtt = (ws.deserializeAttachment() as SocketAttachment) || {
          id: crypto.randomUUID(),
          nickname: "",
          joinedAt: Date.now(),
          chatWindowStart: Date.now(),
          chatCount: 0,
        };

        const isNewJoin = !currentAtt.nickname;
        currentAtt.nickname = rawNickname;
        ws.serializeAttachment(currentAtt);

        // 1. Send state, members, and history to this joining socket only
        const roomState = await this.getRoomState();
        const history = await this.getChatHistory();
        const members = this.getMembers();

        const stateMsg: ServerMessage = {
          type: "state",
          videoId: roomState.videoId,
          mediaType: roomState.mediaType,
          isPlaying: roomState.isPlaying,
          positionSec: roomState.positionSec,
          updatedAt: roomState.updatedAt,
          serverTime: Date.now(),
        };
        ws.send(JSON.stringify(stateMsg));

        const membersMsg: ServerMessage = {
          type: "members",
          nicknames: members,
        };
        ws.send(JSON.stringify(membersMsg));

        const historyMsg: ServerMessage = {
          type: "history",
          messages: history,
        };
        ws.send(JSON.stringify(historyMsg));

        // 2. Broadcast updated members list to other sockets
        this.broadcast(membersMsg, ws);

        // 3. Broadcast system join line if newly joined
        if (isNewJoin) {
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
        }
        return;
      }

      if (data.type === "chat") {
        const att = ws.deserializeAttachment() as SocketAttachment | null;
        if (!att || !att.nickname) {
          ws.send(JSON.stringify({ type: "error", message: "You must join with a nickname before chatting." }));
          return;
        }

        const text = typeof data.text === "string" ? data.text.trim() : "";
        if (text.length === 0) {
          return; // Ignore empty messages
        }
        if (text.length > MAX_CHAT_TEXT_LENGTH) {
          ws.send(JSON.stringify({
            type: "error",
            message: `Message too long (max ${MAX_CHAT_TEXT_LENGTH} characters).`,
          }));
          return;
        }

        // Rate limiting: 5 messages per 5 seconds per socket
        const now = Date.now();
        if (now - att.chatWindowStart > CHAT_RATE_LIMIT_WINDOW_MS) {
          att.chatWindowStart = now;
          att.chatCount = 0;
        }

        if (att.chatCount >= CHAT_RATE_LIMIT_COUNT) {
          ws.send(JSON.stringify({
            type: "error",
            message: "You are chatting too fast. Please wait a few seconds before sending another message.",
          }));
          return;
        }

        att.chatCount += 1;
        ws.serializeAttachment(att);

        // Server stamps message with server time and generates unique ID
        const chatMsg: ChatMessage = {
          id: crypto.randomUUID(),
          nickname: att.nickname,
          text: text,
          time: now,
          isSystem: false,
        };

        // Persist message to Durable Object storage
        await this.addChatMessage(chatMsg);

        // Broadcast to everyone in the room
        this.broadcast({
          type: "chat",
          nickname: chatMsg.nickname,
          text: chatMsg.text,
          time: chatMsg.time,
          isSystem: false,
        });
        return;
      }

      if (data.type === "setVideo") {
        const att = ws.deserializeAttachment() as SocketAttachment | null;
        if (!att || !att.nickname) {
          ws.send(JSON.stringify({ type: "error", message: "You must join with a nickname before changing the video." }));
          return;
        }

        const rawUrl = typeof data.videoId === "string" ? data.videoId.trim() : "";
        const parsedMedia = parseMediaUrl(rawUrl);
        if (!parsedMedia) {
          ws.send(JSON.stringify({
            type: "error",
            message: "Invalid video URL. Please provide a YouTube link (e.g. watch, shorts, youtu.be), a direct video (.mp4/.webm), or embed link.",
          }));
          return;
        }

        const roomState = await this.getRoomState();
        roomState.videoId = parsedMedia.videoId;
        roomState.mediaType = parsedMedia.mediaType;
        roomState.isPlaying = false;
        roomState.positionSec = 0;
        roomState.updatedAt = Date.now();
        await this.ctx.storage.put("room_state", roomState);

        // Broadcast new state to all clients in the room
        const stateMsg: ServerMessage = {
          type: "state",
          videoId: roomState.videoId,
          mediaType: roomState.mediaType,
          isPlaying: roomState.isPlaying,
          positionSec: roomState.positionSec,
          updatedAt: roomState.updatedAt,
          serverTime: Date.now(),
        };
        this.broadcast(stateMsg);

        // Broadcast system notification
        const mediaLabel = parsedMedia.mediaType === 'youtube' ? 'YouTube video' : 'video';
        const changeMsg: ChatMessage = {
          id: crypto.randomUUID(),
          nickname: "System",
          text: `${att.nickname} loaded a new ${mediaLabel}`,
          time: Date.now(),
          isSystem: true,
        };
        await this.addChatMessage(changeMsg);
        this.broadcast({
          type: "chat",
          nickname: changeMsg.nickname,
          text: changeMsg.text,
          time: changeMsg.time,
          isSystem: true,
        });
        return;
      }

      if (data.type === "play") {
        const att = ws.deserializeAttachment() as SocketAttachment | null;
        if (!att || !att.nickname) return;

        const pos = typeof data.positionSec === "number" && data.positionSec >= 0 ? data.positionSec : 0;
        const now = Date.now();
        const roomState = await this.getRoomState();
        roomState.isPlaying = true;
        roomState.positionSec = pos;
        roomState.updatedAt = now;
        await this.ctx.storage.put("room_state", roomState);

        this.broadcast({
          type: "state",
          videoId: roomState.videoId,
          mediaType: roomState.mediaType,
          isPlaying: true,
          positionSec: pos,
          updatedAt: now,
          serverTime: now,
        });
        return;
      }

      if (data.type === "pause") {
        const att = ws.deserializeAttachment() as SocketAttachment | null;
        if (!att || !att.nickname) return;

        const pos = typeof data.positionSec === "number" && data.positionSec >= 0 ? data.positionSec : 0;
        const now = Date.now();
        const roomState = await this.getRoomState();
        roomState.isPlaying = false;
        roomState.positionSec = pos;
        roomState.updatedAt = now;
        await this.ctx.storage.put("room_state", roomState);

        this.broadcast({
          type: "state",
          videoId: roomState.videoId,
          mediaType: roomState.mediaType,
          isPlaying: false,
          positionSec: pos,
          updatedAt: now,
          serverTime: now,
        });
        return;
      }

      if (data.type === "seek") {
        const att = ws.deserializeAttachment() as SocketAttachment | null;
        if (!att || !att.nickname) return;

        const pos = typeof data.positionSec === "number" && data.positionSec >= 0 ? data.positionSec : 0;
        const now = Date.now();
        const roomState = await this.getRoomState();
        roomState.positionSec = pos;
        roomState.updatedAt = now;
        await this.ctx.storage.put("room_state", roomState);

        this.broadcast({
          type: "state",
          videoId: roomState.videoId,
          mediaType: roomState.mediaType,
          isPlaying: roomState.isPlaying,
          positionSec: pos,
          updatedAt: now,
          serverTime: now,
        });
        return;
      }
    } catch (err) {
      const errorMsg: ServerMessage = {
        type: "error",
        message: err instanceof Error ? err.message : "Malformed message",
      };
      ws.send(JSON.stringify(errorMsg));
    }
  }

  async webSocketClose(ws: WebSocket, _code: number, _reason: string, _wasClean: boolean): Promise<void> {
    try {
      const att = ws.deserializeAttachment() as SocketAttachment | null;
      if (att && att.nickname) {
        const remainingMembers = this.getMembers(ws);

        // Broadcast updated members list
        this.broadcast({
          type: "members",
          nicknames: remainingMembers,
        }, ws);

        // Broadcast system leave line
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

      // GET /api/proxy?url=<target> -> Mini Browser proxy gateway (strips X-Frame-Options, CSP, injects base tag, enables range streaming)
      if (request.method === "GET" && url.pathname === "/api/proxy") {
        const targetUrl = url.searchParams.get("url");
        if (!targetUrl) {
          return new Response(JSON.stringify({ error: "Missing url parameter" }), {
            status: 400,
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          });
        }

        try {
          const parsedTarget = new URL(targetUrl);
          if (parsedTarget.protocol !== "http:" && parsedTarget.protocol !== "https:") {
            return new Response(JSON.stringify({ error: "Invalid protocol: must be http or https" }), {
              status: 400,
              headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
            });
          }

          const fetchHeaders = new Headers();
          const range = request.headers.get("range");
          if (range) fetchHeaders.set("range", range);
          fetchHeaders.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
          fetchHeaders.set("Accept", request.headers.get("accept") || "*/*");

          const targetRes = await fetch(targetUrl, {
            headers: fetchHeaders,
            redirect: "follow",
          });

          const responseHeaders = new Headers(targetRes.headers);
          // Strip security restrictions and framing blockers
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
            // Since we decoded the text into uncompressed HTML, remove compression and length headers
            responseHeaders.delete("content-encoding");
            responseHeaders.delete("content-length");

            // Set cookie so all subrequests know what target origin to proxy to
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

        // Forward request to RoomDO
        const doUrl = new URL(request.url);
        doUrl.pathname = "/ws";
        return stub.fetch(new Request(doUrl.toString(), request));
      }

      // Reverse-proxy subresource fallback (e.g. /_app/..., /_next/..., /assets/...)
      // Check both Cookie and Referer for the target origin:
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
