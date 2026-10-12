# Visible — System Architecture

## Overview

Visible is an educational web application designed to teach networking and systems engineering through real-time observation, interactive 3D visualizations, and inspectable protocol data.

The system is designed with a strict principle: **always distinguish real observations from derived data and simulations.**

## System Boundaries

```
┌─────────────────────────────────────────────────────────────┐
│                       Browser Client                        │
│                                                             │
│  ┌───────────────┐  ┌───────────────┐  ┌─────────────────┐  │
│  │ Article/Expl. │  │  3D Visualizer│  │  Live Experiment│  │
│  │ (Markdown/UI) │  │  (Three.js/   │  │  (Real WebRTC   │  │
│  │               │  │   R3F Canvas) │  │   Connection)   │  │
│  └───────┬───────┘  └───────▲───────┘  └────────┬────────┘  │
│          │                  │                   │           │
│          └──────────┐       │       ┌───────────┘           │
│                     ▼       │       ▼                       │
│              ┌─────────────────────────────┐                │
│              │     State & Event Bus       │                │
│              │   (ICE, DTLS, Stats, Track) │                │
│              └──────────────┬──────────────┘                │
│                             │                               │
│              ┌──────────────▼──────────────┐                │
│              │    Browser WebRTC APIs      │                │
│              │   (RTCPeerConnection,       │                │
│              │    RTCDataChannel, getStats)│                │
│              └──────────────┬──────────────┘                │
└─────────────────────────────┼───────────────────────────────┘
                              │
               WebSocket (Signaling) [Local/Dev]
                              │
┌─────────────────────────────▼───────────────────────────────┐
│                    Signaling Service                        │
│             (Node.js / ws — lightweight relay)              │
│       - SDP Offer/Answer relay                              │
│       - ICE candidate exchange                              │
│       - Room/session management                             │
│       - No media passes through here                        │
└─────────────────────────────────────────────────────────────┘
```

## Module Responsibilities

### 1. `src/components/`
Reusable UI components following the project's design system:
- Layout (Header, Navigation, Sidebar)
- Controls (Connect, Disconnect, Send Message buttons)
- Panels (Stats panel, Event log, Packet inspector)
- Status indicators (ConnectionState, ICEConnectionState)

### 2. `src/pages/`
Route-level views for each educational module:
- `webrtc/1to1` — One-to-one peer connection lab
- `webrtc/mesh` — Multi-peer mesh topology lab
- `webrtc/sfu` — Selective Forwarding Unit architecture lab

### 3. `src/services/`
Core networking and data logic:
- `webrtc.ts` — `RTCPeerConnection` lifecycle management, event listeners, offer/answer handling
- `signaling.ts` — WebSocket signaling client (connect, send, receive, reconnect)
- `stats.ts` — `getStats()` polling, parsing, and normalization for the UI

### 4. `src/hooks/`
React hooks wrapping services for component consumption:
- `useWebRTC` — Connection state, local/remote streams, data channel
- `useSignaling` — Signaling connection status, room management
- `usePeerStats` — Polled and formatted connection statistics

### 5. `src/types/`
TypeScript interfaces shared across the application:
- `webrtc.ts` — Connection state types, event payloads, stat shapes
- `signaling.ts` — Message types (offer, answer, candidate, room events)
- `visualization.ts` — 3D scene node and edge definitions

### 6. `src/utils/`
Pure utility functions:
- SDP parsing helpers (extract codecs, candidate types)
- Formatting utilities (bitrate, packet count, latency)
- Data export (copy SDP, download session log)

## Data Classification

Every piece of data displayed in Visible must belong to one of three categories:

| Category | Definition | Visual Indicator |
|----------|------------|------------------|
| **Real Observation** | Directly from browser APIs (`RTCPeerConnection`, `getStats()`) | Green badge / dot |
| **Derived Data** | Calculated from real observations (e.g., bitrate = bytesReceived Δ / time Δ) | Blue badge / dot |
| **Simulation** | Synthetic data for concepts the browser cannot natively demonstrate | Amber badge / dot |

## Asset Pipeline (3D)

```
Blender (Source) ──► Export GLB ──► public/assets/ ──► Loaded via Three.js / R3F
```

- Source `.blend` files remain outside Git (large binary, ignored in `.gitignore`)
- Exported `.glb` files placed in `public/assets/`
- Claude handles Blender-specific asset creation
- Cline + OmniRoute handles web integration, lighting, interaction, and scene composition

## Technology Choices & Rationale

| Choice | Rationale | Alternatives Considered |
|--------|-----------|------------------------|
| **Vite** | Fast HMR, lightweight build, ESM-native | Next.js (overkill for an educational SPA), CRA (deprecated) |
| **React 19** | Modern UI component model, concurrent features | Vue, Svelte (React requested by spec) |
| **TypeScript** | Type safety for complex WebRTC state machines and stat objects | Vanilla JS (error-prone for WebRTC state) |
| **Native WebRTC APIs** | Real learning requires seeing actual browser APIs, not library abstractions | Simple-peer, PeerJS (hide the details we want to teach) |
| **WebSocket Signaling** | Simple, standard, bidirectional, no external services needed for local dev | Firebase, Supabase (adds third-party dependency) |
| **GLB/glTF** | Web-standard 3D format, compact binary, supported by Three.js | OBJ/FBX (larger, less web-optimized) |
