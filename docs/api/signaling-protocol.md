# Visible Signaling Protocol Specification

## Purpose
The Visible signaling server acts as a lightweight rendezvous and negotiation relay for WebRTC peers. WebRTC requires an out-of-band communication channel (signaling) to exchange session descriptions (SDP offers and answers) and ICE candidates before establishing a direct peer-to-peer connection.

## Transport
- **Protocol**: WebSocket (`ws://` for local development, `wss://` for production)
- **Default Port**: `3001` (configurable via `process.env.PORT`)
- **Default Max Payload**: 64 KB (65,536 bytes)
- **Serialization**: JSON text frames
- **Frame-Size Enforcement**: The `ws` server enforces `maxPayload` at the WebSocket frame level. A frame exceeding the limit is dropped and the connection is closed with close code `1009` (Policy Violation / Message Too Big); the application message handler never receives the oversized frame, so no application-level `MESSAGE_TOO_LARGE` error is returned.

## Security & Identity Boundary
- **Sender Spoofing Prevention**: The signaling server does not trust client-supplied `senderId` values. When a client connects, the server assigns a cryptographically unique `clientId` (`crypto.randomUUID()`).
- **Server Timestamping**: The server injects authoritative Unix millisecond timestamps on relayed and acknowledgement messages.
- **Room Isolation**: Clients must explicitly join a room before sending negotiation messages. Relayed messages are routed only to participants in that specific room, excluding the sender.

---

## Message Format

All protocol messages adhere to the following schema:

```typescript
export type SignalingMessageType =
  | 'join'
  | 'joined'
  | 'offer'
  | 'answer'
  | 'candidate'
  | 'leave'
  | 'peer-joined'
  | 'peer-left'
  | 'error';

export interface SignalingMessage {
  type: SignalingMessageType;
  roomId: string;
  senderId?: string;
  payload?: unknown;
  timestamp?: number;
}
```

---

## Client-to-Server Messages

### 1. `join`
Requests entry into a signaling room.
- **Client Payload**:
```json
{
  "type": "join",
  "roomId": "alpha-room"
}
```
- **Validation**: `roomId` must be 1–64 characters matching `^[a-zA-Z0-9_-]{1,64}$`.

### 2. `offer`
Relays an SDP offer to other peers in the room.
- **Client Payload**:
```json
{
  "type": "offer",
  "roomId": "alpha-room",
  "payload": {
    "type": "offer",
    "sdp": "v=0\r\no=- 123456 2 IN IP4 127.0.0.1\r\n..."
  }
}
```
- **Prerequisite**: Client must have joined `roomId`.

### 3. `answer`
Relays an SDP answer back to the offering peer in the room.
- **Client Payload**:
```json
{
  "type": "answer",
  "roomId": "alpha-room",
  "payload": {
    "type": "answer",
    "sdp": "v=0\r\no=- 654321 2 IN IP4 127.0.0.1\r\n..."
  }
}
```

### 4. `candidate`
Relays an trickle ICE candidate to peers in the room.
- **Client Payload**:
```json
{
  "type": "candidate",
  "roomId": "alpha-room",
  "payload": {
    "candidate": "candidate:1 1 UDP 2130706431 192.168.1.10 54321 typ host",
    "sdpMid": "0",
    "sdpMLineIndex": 0
  }
}
```

### 5. `leave`
Voluntarily leaves a room.
- **Client Payload**:
```json
{
  "type": "leave",
  "roomId": "alpha-room"
}
```

---

## Server-to-Client Messages

### 1. `joined`
Sent to the joining client confirming room entry. Room joins are idempotent: if a client sends a subsequent `join` for a room it is already in, the server returns the `joined` acknowledgement with current participant count, but does not re-broadcast `peer-joined` to other room members.
```json
{
  "type": "joined",
  "roomId": "alpha-room",
  "senderId": "7b884d56-78bc-4674-8848-f6236b3f7f89",
  "payload": { "clientsInRoom": 2 },
  "timestamp": 1740000000000
}
```

### 2. `peer-joined`
Broadcast to existing room participants when a new peer joins for the first time. Duplicate joins from already-present participants do not trigger duplicate `peer-joined` notices.
```json
{
  "type": "peer-joined",
  "roomId": "alpha-room",
  "senderId": "7b884d56-78bc-4674-8848-f6236b3f7f89",
  "timestamp": 1740000000000
}
```

### 3. `peer-left`
Broadcast to remaining room participants when a peer leaves or disconnects.
```json
{
  "type": "peer-left",
  "roomId": "alpha-room",
  "senderId": "7b884d56-78bc-4674-8848-f6236b3f7f89",
  "timestamp": 1740000000000
}
```

### 4. `error`
Returned when a client message fails validation or violates room state.
```json
{
  "type": "error",
  "roomId": "alpha-room",
  "senderId": "server",
  "payload": {
    "code": "NOT_IN_ROOM",
    "message": "Client must join room before sending negotiation messages"
  },
  "timestamp": 1740000000000
}
```

#### Error Codes:
- `UNSUPPORTED_DATA`: Non-text frame received.
- `INVALID_JSON`: Malformed JSON syntax.
- `INVALID_STRUCTURE`: JSON value is not an object.
- `INVALID_TYPE`: Unrecognized message type.
- `INVALID_ROOM_ID`: Room ID does not match `^[a-zA-Z0-9_-]{1,64}$`.
- `INVALID_PAYLOAD`: Negotiation message (`offer`, `answer`, `candidate`) payload is missing, null, primitive, or array.
- `NOT_IN_ROOM`: Attempted to send negotiation messages before joining room.
- `ROOM_NOT_FOUND`: Target room does not exist.
