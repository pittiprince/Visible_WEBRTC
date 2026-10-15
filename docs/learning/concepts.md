# WebRTC Reusable Concepts & Engineering Foundations

## 1. Out-of-Band Signaling in WebRTC
WebRTC is intentionally agnostic about how peers discover each other and negotiate connection parameters. The W3C specification standardizes `RTCPeerConnection`, `RTCDataChannel`, SDP offer/answer states, and ICE candidate generation, but explicitly leaves the signaling transport out of band.
- **Why?** Different applications have completely divergent signaling topologies: some use WebSockets (bidirectional full duplex), others use HTTP polling, SSE, MQTT, or SIP.
- **Project Implementation**: In Visible, we use a lightweight WebSocket server (`server/signaling.ts`) to route JSON packets containing SDP session descriptions (`offer`, `answer`) and ICE candidates (`candidate`).

## 2. Ephemeral Ports in Integration Testing (`port: 0`)
When writing automated tests for network servers, hardcoding static ports (such as `3001` or `8080`) introduces test fragility:
- Tests fail if a local dev server is currently running.
- Parallel test runners collide on the same port.
- CI runners can have lingering zombie processes.
- **Solution**: Passing `port: 0` to Node.js `server.listen()` instructs the operating system kernel to allocate any currently free ephemeral port. The server reads `server.address().port` after binding, and the test client connects directly to that dynamic port.
- **Project Implementation**: `tests/signaling.test.ts` dynamically binds `serverInstance = await createSignalingServer({ port: 0 })`, guaranteeing complete isolation and zero port clashes.

## 3. Server-Attested Identity vs. Client Spoofing
In peer-to-peer negotiation, clients frequently include identifiers in their message bodies. If the signaling relay blindly accepts a client-provided `senderId`, malicious clients can spoof other participants or forge session descriptions.
- **Pattern**: Associate the identity with the server-side transport session (the active `WebSocket` instance), not the incoming payload.
- **Project Implementation**: When a socket connects, the server mints `clientId = randomUUID()`. When forwarding negotiation messages, the server overrides any client-supplied `senderId` with the verified server-side `clientId`.

## 4. Memory Leak Prevention in In-Memory Room Topologies
When tracking room membership with nested maps (`Map<roomId, Map<clientId, WebSocket>>`):
- Dropped TCP connections without explicit `leave` messages would accumulate dead sockets and empty room maps over time.
- **Pattern**: Listen to both `close` and `error` events on each socket. Maintain a reverse index (`WeakMap` or socket session) mapping the socket to its joined rooms. When the socket drops, purge it from all room maps, delete vacant room maps, and notify surviving room peers with `peer-left`.
