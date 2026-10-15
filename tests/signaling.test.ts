import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import {
  createSignalingServer,
  type SignalingServerInstance,
} from '../server/signaling.js';
import type { SignalingMessage } from '../src/types/webrtc.js';

describe('Signaling Server', () => {
  let serverInstance: SignalingServerInstance;
  let serverUrl: string;
  const activeSockets: WebSocket[] = [];

  beforeEach(async () => {
    // Port 0 picks an available ephemeral port
    serverInstance = await createSignalingServer({ port: 0, maxPayload: 1024 });
    serverUrl = `ws://localhost:${serverInstance.port}`;
  });

  afterEach(async () => {
    for (const ws of activeSockets) {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.terminate();
      }
    }
    activeSockets.length = 0;
    await serverInstance.close();
  });

  function connectClient(): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(serverUrl);
      activeSockets.push(ws);
      ws.on('open', () => resolve(ws));
      ws.on('error', (err) => reject(err));
    });
  }

  function waitForMessage(
    ws: WebSocket,
    predicate: (msg: SignalingMessage) => boolean,
    timeoutMs = 2000
  ): Promise<SignalingMessage> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timed out waiting for message after ${timeoutMs}ms`));
      }, timeoutMs);

      const listener = (data: unknown) => {
        try {
          const raw = typeof data === 'string' ? data : (data as Buffer).toString('utf-8');
          const msg = JSON.parse(raw) as SignalingMessage;
          if (predicate(msg)) {
            clearTimeout(timer);
            ws.off('message', listener);
            resolve(msg);
          }
        } catch {
          // ignore invalid JSON
        }
      };
      ws.on('message', listener);
    });
  }

  // Helper to extract client ID from joined message
  function extractClientId(msg: SignalingMessage): string {
    // The joined message contains senderId which is the client's ID
    return msg.senderId;
  }

  it('handles explicit leave: sender receives no ack, peer gets peer-left, sender can rejoin', async () => {
    const clientA = await connectClient();
    const clientB = await connectClient();
    const roomId = 'room-leave-test';

    // Both join the room
    clientA.send(JSON.stringify({ type: 'join', roomId }));
    await waitForMessage(clientA, (m) => m.type === 'joined');

    clientB.send(JSON.stringify({ type: 'join', roomId }));
    await waitForMessage(clientB, (m) => m.type === 'joined');
    await waitForMessage(clientA, (m) => m.type === 'peer-joined');

    // Track peer-left messages received by A
    const aPeerLeftMessages: SignalingMessage[] = [];
    const aListener = (data: unknown) => {
      try {
        const raw = typeof data === 'string' ? data : (data as Buffer).toString('utf-8');
        const msg = JSON.parse(raw) as SignalingMessage;
        if (msg.type === 'peer-left') {
          aPeerLeftMessages.push(msg);
        }
      } catch {
        // ignore
      }
    };
    clientA.on('message', aListener);

    // B sends leave
    clientB.send(JSON.stringify({ type: 'leave', roomId }));

    // A should receive exactly one peer-left for B
    const peerLeftMsg = await waitForMessage(clientA, (m) => m.type === 'peer-left');
    expect(peerLeftMsg.type).toBe('peer-left');
    expect(peerLeftMsg.roomId).toBe(roomId);
    expect(peerLeftMsg.senderId).not.toBe(clientA); // Basic sanity: not from self

    // Clean up A's listener briefly to avoid interference
    clientA.off('message', aListener);

    // Verify B can still use connection and rejoin
    const bRejoinPromise = waitForMessage(clientB, (m) => m.type === 'joined');
    clientB.send(JSON.stringify({ type: 'join', roomId }));
    await bRejoinPromise;

    // Clean up
    clientA.removeAllListeners();
    clientB.removeAllListeners();
  });

  it('rejects negotiation messages before joining and prevents relay', async () => {
    const clientInRoom = await connectClient();
    const clientNotInRoom = await connectClient();
    const roomId = 'room-negotiation-test';

    // Only one client joins the room
    clientInRoom.send(JSON.stringify({ type: 'join', roomId }));
    await waitForMessage(clientInRoom, (m) => m.type === 'joined');

    // Track negotiation messages received by the client in room
    const inRoomNegotiation: SignalingMessage[] = [];
    const inRoomListener = (data: unknown) => {
      try {
        const raw = typeof data === 'string' ? data : (data as Buffer).toString('utf-8');
        const msg = JSON.parse(raw) as SignalingMessage;
        if (msg.type === 'offer' || msg.type === 'answer' || msg.type === 'candidate') {
          inRoomNegotiation.push(msg);
        }
      } catch {
        // ignore
      }
    };
    clientInRoom.on('message', inRoomListener);

    // Test offer before join -> NOT_IN_ROOM
    const offerErrPromise = waitForMessage(clientNotInRoom, (m) => m.type === 'error');
    clientNotInRoom.send(JSON.stringify({
      type: 'offer',
      roomId,
      payload: { sdp: 'test', type: 'offer' }
    }));
    const offerErr = await offerErrPromise;
    expect(offerErr.type).toBe('error');
    expect((offerErr.payload as { code: string }).code).toBe('NOT_IN_ROOM');

    // Test answer before join -> NOT_IN_ROOM
    const answerErrPromise = waitForMessage(clientNotInRoom, (m) => m.type === 'error');
    clientNotInRoom.send(JSON.stringify({
      type: 'answer',
      roomId,
      payload: { sdp: 'test', type: 'answer' }
    }));
    const answerErr = await answerErrPromise;
    expect(answerErr.type).toBe('error');
    expect((answerErr.payload as { code: string }).code).toBe('NOT_IN_ROOM');

    // Test candidate before join -> NOT_IN_ROOM
    const candidateErrPromise = waitForMessage(clientNotInRoom, (m) => m.type === 'error');
    clientNotInRoom.send(JSON.stringify({ type: 'candidate', roomId, payload: { candidate: 'test', sdpMid: '0', sdpMLineIndex: 0 }}));
    const candidateErr = await candidateErrPromise;
    expect(candidateErr.type).toBe('error');
    expect((candidateErr.payload as { code: string }).code).toBe('NOT_IN_ROOM');

    // Verify client in room received NONE of these negotiation messages
    expect(inRoomNegotiation).toHaveLength(0);

    // Clean up
    clientInRoom.off('message', inRoomListener);
    clientInRoom.removeAllListeners();
    clientNotInRoom.removeAllListeners();
  });
   it('test explicit room leave: B leaves, A receives exactly one peer-left for B', async () => {
     const clientA = await connectClient();
     const clientB = await connectClient();
     const roomId = 'test-explicit-leave-room';

     // Both join the room
     clientA.send(JSON.stringify({ type: 'join', roomId }));
     await waitForMessage(clientA, (m) => m.type === 'joined');

     clientB.send(JSON.stringify({ type: 'join', roomId }));
     await waitForMessage(clientB, (m) => m.type === 'joined');
      
      // Get B's client ID from the peer-joined message sent to A
      const peerJoinedMsg = await waitForMessage(clientA, (m) => m.type === 'peer-joined');
      const bClientId = peerJoinedMsg.senderId;

     // Track peer-left messages received by A
     const aPeerLeftMessages: SignalingMessage[] = [];
     const aListener = (data: unknown) => {
       try {
         const raw = typeof data === 'string' ? data : (data as Buffer).toString('utf-8');
         const msg = JSON.parse(raw) as SignalingMessage;
         if (msg.type === 'peer-left') {
           aPeerLeftMessages.push(msg);
         }
       } catch {
         // ignore
       }
     };
     clientA.on('message', aListener);

     // B sends leave
     clientB.send(JSON.stringify({ type: 'leave', roomId }));

     // A should receive exactly one peer-left for B
     const peerLeftMsg = await waitForMessage(clientA, (m) => m.type === 'peer-left');
     expect(peerLeftMsg.type).toBe('peer-left');
     expect(peerLeftMsg.roomId).toBe(roomId);
     expect(peerLeftMsg.senderId).toBe(bClientId); // Should be from B
     expect(aPeerLeftMessages.length).toBe(1); // Exactly one message

     // Clean up
     clientA.off('message', aListener);
     clientA.removeAllListeners();
     clientB.removeAllListeners();
   });

});