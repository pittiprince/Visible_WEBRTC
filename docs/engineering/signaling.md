# Signaling Server Operations & Security Reference

## Overview
Visible's Phase 01B.1 implements a standalone, lightweight WebSocket signaling server (`server/signaling.ts`) designed for local-development 1:1 WebRTC negotiation.

## Quickstart

### Starting the Server
```bash
npm run signaling
```
By default, the server listens on `ws://localhost:3001`.

To customize the port:
```bash
PORT=4000 npm run signaling
```

### Running Automated Tests
```bash
npx vitest run tests/signaling.test.ts
```
The test suite utilizes dynamic ephemeral ports (`port: 0`), preventing port collision with active development servers or background processes.

To run all project tests:
```bash
npm test
```

---

## Architectural Guarantees

1. **Ephemeral Lifecycle**:
   - Zero database or persistent storage requirements.
   - Rooms and connection sessions are maintained entirely in-memory and reclaimed automatically upon disconnect or room vacancy.
2. **Strict Identity Attestation**:
   - Client-supplied `senderId` values are never trusted or relayed.
   - The server mints a unique `clientId` via `node:crypto.randomUUID()` upon WebSocket connection and attaches it to all outbound room broadcasts.
3. **Room Isolation**:
   - Messages are partitioned strictly by `roomId`.
   - Participants must execute a valid `join` handshake before transmitting SDP or ICE candidate packets.
   - Senders never receive echoed reflections of their own messages.
4. **Boundary Validation & Defensive Sizing**:
   - Maximum frame payload size is capped at 64 KB (`65536` bytes).
   - `roomId` values are validated against `/^[a-zA-Z0-9_-]{1,64}$/`.
   - Malformed frames or unsupported action types return structured `{ type: 'error' }` replies without server disruption.
5. **Clean Signal Handling**:
   - Listens for `SIGINT` and `SIGTERM` signals.
   - Gracefully terminates connected client sockets and releases HTTP server port bindings.

---

## Security & Privacy Limitations

> **WARNING**: This signaling server is engineered solely as local-development infrastructure. It is **NOT** configured for production internet deployment.

- **No Authentication or Authorization**: Any client capable of reaching `ws://localhost:3001` can join any room identifier.
- **Unencrypted Transport (Local Only)**: Uses unencrypted `ws://`. For public networks, TLS-encrypted `wss://` with reverse proxy termination is required.
- **No Rate Limiting or Anti-DoS**: Does not implement IP-based rate limiting, connection quotas, or proof-of-work challenges.
- **Exposure Risk**: Do not bind this server to public network interfaces (`0.0.0.0`) without authenticating reverse proxy ingress and strict TLS enforcement.
- **Credential Neutrality**: The signaling server does not handle or store TURN credentials. TURN credentials must remain protected on the backend and never exposed through client-side bundles.

---

## Verification Status

| Scope Item | Status | Evidence |
|---|---|---|
| Server Startup & Port Binding | VERIFIED | Starts on default `ws://localhost:3001` and custom `PORT` |
| Room Join / Leave Lifecycle | VERIFIED | Passing unit test `tests/signaling.test.ts` |
| SDP Offer / Answer Relay | VERIFIED | Passing unit test `tests/signaling.test.ts` |
| ICE Candidate Relay | VERIFIED | Passing unit test `tests/signaling.test.ts` |
| Room Boundary Isolation | VERIFIED | Passing unit test `tests/signaling.test.ts` |
| Malformed JSON & Bad Types | VERIFIED | Passing unit test `tests/signaling.test.ts` |
| Max Payload Enforcement | VERIFIED | Passing unit test `tests/signaling.test.ts` |
| Client Disconnect Cleanup | VERIFIED | Passing unit test `tests/signaling.test.ts` |
| Graceful Shutdown (SIGINT) | VERIFIED | Process terminates cleanly with exit code 0 |
| Real WebRTC Peer Connection | UNVERIFIED | Deferred to Phase 01B.2 (`src/services/peer.ts`) |
| React UI Signaling Integration | UNVERIFIED | Deferred to Phase 01B.3+ |
