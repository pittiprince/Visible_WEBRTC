import { WebSocketServer, WebSocket } from 'ws';
import { createServer, type Server as HttpServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import type { SignalingMessage, SignalingMessageType } from '../src/types/webrtc.js';

export const DEFAULT_SIGNALING_PORT = 3001;
export const MAX_MESSAGE_SIZE = 65536; // 64 KB limit
export const ROOM_ID_REGEX = /^[a-zA-Z0-9_-]{1,64}$/;

const ALLOWED_CLIENT_MESSAGE_TYPES = new Set<SignalingMessageType>([
  'join',
  'offer',
  'answer',
  'candidate',
  'leave',
]);

interface ClientSession {
  clientId: string;
  rooms: Set<string>;
}

export interface SignalingServerOptions {
  port?: number;
  maxPayload?: number;
}

export interface SignalingServerInstance {
  server: HttpServer;
  wss: WebSocketServer;
  port: number;
  close: () => Promise<void>;
}

function sendErrorMessage(
  ws: WebSocket,
  message: string,
  roomId: string = '',
  code: string = 'BAD_REQUEST'
): void {
  if (ws.readyState === WebSocket.OPEN) {
    const errorPayload: SignalingMessage = {
      type: 'error',
      roomId,
      senderId: 'server',
      payload: { code, message },
      timestamp: Date.now(),
    };
    ws.send(JSON.stringify(errorPayload));
  }
}
export function createSignalingServer(
  options: SignalingServerOptions = {}
): Promise<SignalingServerInstance> {
  const port = options.port ?? DEFAULT_SIGNALING_PORT;
  const maxPayload = options.maxPayload ?? MAX_MESSAGE_SIZE;

  const server = createServer();
  const wss = new WebSocketServer({ server, maxPayload });

  const rooms = new Map<string, Map<string, WebSocket>>();
  const clients = new Map<WebSocket, ClientSession>();

  function cleanupClientFromRooms(ws: WebSocket): void {
    const session = clients.get(ws);
    if (!session) return;

    for (const roomId of session.rooms) {
      const room = rooms.get(roomId);
      if (room) {
        room.delete(session.clientId);
        if (room.size === 0) {
          rooms.delete(roomId);
        } else {
          const leaveNotice: SignalingMessage = {
            type: 'peer-left',
            roomId,
            senderId: session.clientId,
            timestamp: Date.now(),
          };
          const serialized = JSON.stringify(leaveNotice);
          for (const peerWs of room.values()) {
            if (peerWs.readyState === WebSocket.OPEN) {
              peerWs.send(serialized);
            }
          }
        }
      }
    }
    session.rooms.clear();
    clients.delete(ws);
  }

  wss.on('connection', (ws: WebSocket) => {
    const clientId = randomUUID();
    const session: ClientSession = {
      clientId,
      rooms: new Set(),
    };
    clients.set(ws, session);

    ws.on('message', (data: unknown) => {
      let rawString = '';
      if (typeof data === 'string') {
        rawString = data;
      } else if (Buffer.isBuffer(data)) {
        rawString = data.toString('utf-8');
      } else {
        sendErrorMessage(ws, 'Unsupported binary message format', '', 'UNSUPPORTED_DATA');
        return;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(rawString);
      } catch {
        sendErrorMessage(ws, 'Malformed JSON payload', '', 'INVALID_JSON');
        return;
      }

      if (!parsed || typeof parsed !== 'object') {
        sendErrorMessage(ws, 'Message must be a valid JSON object', '', 'INVALID_STRUCTURE');
        return;
      }

      const msg = parsed as Partial<SignalingMessage>;

      if (!msg.type || !ALLOWED_CLIENT_MESSAGE_TYPES.has(msg.type as SignalingMessageType)) {
        sendErrorMessage(ws, `Unsupported message type: ${String(msg.type)}`, '', 'INVALID_TYPE');
        return;
      }

      if (!msg.roomId || typeof msg.roomId !== 'string' || !ROOM_ID_REGEX.test(msg.roomId)) {
        sendErrorMessage(
          ws,
          'Invalid roomId: must be 1-64 characters matching [a-zA-Z0-9_-]',
          typeof msg.roomId === 'string' ? msg.roomId : '',
          'INVALID_ROOM_ID'
        );
        return;
      }

      const roomId = msg.roomId;

      if (msg.type === 'join') {
        const isDuplicate = session.rooms.has(roomId);
        session.rooms.add(roomId);
        let room = rooms.get(roomId);
        if (!room) {
          room = new Map();
          rooms.set(roomId, room);
        }

        room.set(clientId, ws);

        const joinedAck: SignalingMessage = {
          type: 'joined',
          roomId,
          senderId: clientId,
          payload: { clientsInRoom: room.size },
          timestamp: Date.now(),
        };
        ws.send(JSON.stringify(joinedAck));

        // Only broadcast peer-joined on first join, not duplicates
        if (!isDuplicate) {
          const peerJoinedNotice: SignalingMessage = {
            type: 'peer-joined',
            roomId,
            senderId: clientId,
            timestamp: Date.now(),
          };
          const serialized = JSON.stringify(peerJoinedNotice);
          for (const [otherClientId, otherWs] of room.entries()) {
            if (otherClientId !== clientId && otherWs.readyState === WebSocket.OPEN) {
              otherWs.send(serialized);
            }
          }
        }
        return;
      }

      if (msg.type === 'leave') {
        if (session.rooms.has(roomId)) {
          session.rooms.delete(roomId);
          const room = rooms.get(roomId);
          if (room) {
            room.delete(clientId);
            if (room.size === 0) {
              rooms.delete(roomId);
            } else {
              const peerLeftNotice: SignalingMessage = {
                type: 'peer-left',
                roomId,
                senderId: clientId,
                timestamp: Date.now(),
              };
              const serialized = JSON.stringify(peerLeftNotice);
              for (const otherWs of room.values()) {
                if (otherWs.readyState === WebSocket.OPEN) {
                  otherWs.send(serialized);
                }
              }
            }
          }
        }
        return;
      }

      // 'offer' | 'answer' | 'candidate'
      if (
        !msg.payload ||
        typeof msg.payload !== 'object' ||
        Array.isArray(msg.payload)
      ) {
        sendErrorMessage(
          ws,
          `Invalid payload: ${String(msg.type)} requires a non-null object payload`,
          roomId,
          'INVALID_PAYLOAD'
        );
        return;
      }

      if (!session.rooms.has(roomId)) {
        sendErrorMessage(
          ws,
          'Client must join room before sending negotiation messages',
          roomId,
          'NOT_IN_ROOM'
        );
        return;
      }

      const room = rooms.get(roomId);
      if (!room) {
        sendErrorMessage(ws, 'Room not found', roomId, 'ROOM_NOT_FOUND');
        return;
      }

      const relayedMessage: SignalingMessage = {
        type: msg.type,
        roomId,
        senderId: clientId,
        payload: msg.payload,
        timestamp: Date.now(),
      };
      const serialized = JSON.stringify(relayedMessage);

      for (const [recipientId, recipientWs] of room.entries()) {
        if (recipientId !== clientId && recipientWs.readyState === WebSocket.OPEN) {
          recipientWs.send(serialized);
        }
      }
    });

    ws.on('close', () => {
      cleanupClientFromRooms(ws);
    });

    ws.on('error', () => {
      cleanupClientFromRooms(ws);
    });
  });

  return new Promise((resolve, reject) => {
    server.on('error', (err) => {
      reject(err);
    });

    server.listen(port, () => {
      const address = server.address();
      const actualPort = typeof address === 'object' && address !== null ? address.port : port;
      resolve({
        server,
        wss,
        port: actualPort,
        close: () =>
          new Promise<void>((res, rej) => {
            for (const client of wss.clients) {
              client.terminate();
            }
            wss.close((wssErr) => {
              if (wssErr) {
                rej(wssErr);
                return;
              }
              server.close((srvErr) => {
                if (srvErr) rej(srvErr);
                else res();
              });
            });
          }),
      });
    });
  });
}

const isDirectExecution =
  process.argv[1] &&
  (process.argv[1].endsWith('signaling.ts') || process.argv[1].endsWith('signaling.js'));

if (isDirectExecution) {
  const port = Number(process.env.PORT) || DEFAULT_SIGNALING_PORT;
  createSignalingServer({ port })
    .then((instance) => {
      console.log(`[Visible Signaling] Server started on ws://localhost:${instance.port}`);

      const shutdown = async () => {
        console.log('\n[Visible Signaling] Shutting down gracefully...');
        await instance.close();
        process.exit(0);
      };

      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
    })
    .catch((err) => {
      console.error('[Visible Signaling] Startup error:', err);
      process.exit(1);
    });
}
