# Daily Engineering Learning Log

## 2026-10-12 — Phase 01B.1: Local Signaling Server & Test Harness

### What Was Built
- Implemented `server/signaling.ts`: A minimal, zero-database Node.js WebSocket signaling relay on default port `3001` using `ws`.
- Added server-side room partitioning, frame length capping (64 KB), room identifier regex validation, and spoof-proof sender identification using `crypto.randomUUID()`.
- Added automated integration suite `tests/signaling.test.ts` testing 9 scenarios with 100% ephemeral port isolation.
- Created signaling protocol specification (`docs/api/signaling-protocol.md`) and operational reference (`docs/engineering/signaling.md`).
- Extended `SignalingMessage` and added `SignalingMessageType` in `src/types/webrtc.ts` in a backward-compatible manner.

- **Refactor 01 (Idempotent Room Join)**: Hardened `join` handler in `server/signaling.ts` to check `session.rooms.has(roomId)` before inserting. Prevents duplicate `peer-joined` broadcast floods if a client reconnects or re-issues `join`, while still safely returning a `joined` acknowledgment with the active room participant count. Deterministic regression test added to `tests/signaling.test.ts`.

- **Refactor 02 (Negotiation Payload Validation)**: Validated `payload` for `offer`, `answer`, and `candidate` messages at their common negotiation boundary in `server/signaling.ts`. Rejects missing, null, primitive, and array payloads with `INVALID_PAYLOAD` before relaying, keeping invalid payloads from propagating to peers while preserving valid relaying, sender identity, and room isolation. Added full regression test suite in `tests/signaling.test.ts`.

- **Refactor 03 (Oversized-Message Handling)**: Removed the redundant application-level `MESSAGE_TOO_LARGE` check inside the `message` handler (it could never run because `ws` enforces `maxPayload` at the frame level, before the handler is invoked). `maxPayload` on the `ws` WebSocketServer is now the sole authoritative frame-size limit: any frame exceeding it is dropped and the connection is closed with close code `1009`. The integration test was updated to assert the `1009` close code deterministically. Updated the protocol spec to document this behavior and remove the misleading `MESSAGE_TOO_LARGE` error-code entry.

### Key Decisions & Trade-Offs
- **Zero-Storage In-Memory Architecture**: Avoided databases or stateful persistence layers to adhere strictly to YAGNI for local WebRTC exploration.
- **Port 0 in Vitest**: Ensured tests never conflict with port 3001 or any existing developer environment.
- **Node 24 `--experimental-strip-types`**: Ran TypeScript server directly in Node 24 without compiling or adding extra dev runner dependencies like tsx/ts-node.
- **Explicit Server Error Codes**: Emitted bounded JSON error codes (`INVALID_ROOM_ID`, `NOT_IN_ROOM`, `INVALID_JSON`, `INVALID_STRUCTURE`, `INVALID_TYPE`, `INVALID_PAYLOAD`, `UNSUPPORTED_DATA`) so clients have clear diagnostics without crashing or hanging. The only frame-size failure mode is the `ws` layer closing the connection with close code `1009`; no application-level `MESSAGE_TOO_LARGE` code exists anymore.

### Open Questions & Next Steps
- **Next Slice (Phase 01B.2)**: Build the client-side WebRTC connection manager (`src/services/peer.ts`) and signaling client (`src/services/signaling.ts`) to establish an actual peer-to-peer `RTCDataChannel`.
- **Media Track Permissions**: Media streams will remain optional/deferred to avoid browser permission popups while testing the data plane.
