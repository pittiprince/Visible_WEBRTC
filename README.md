# Visible

**Making complex technology understandable** through articles, fundamentals, interactive 3D visualizations, real code, inspectable data, and experiments.

## What is Visible?

Visible is an educational platform that explains networking and systems concepts by showing you what actually happens — not just diagrams, but live connections, real protocol events, captured packets, and interactive 3D scenes.

### First Module: WebRTC

The initial content covers WebRTC peer-to-peer communication:

1. **One-to-one P2P connection** — signaling, ICE, DTLS, SRTP explained with a live working demo
2. **Mesh topology** — multiple peers, the scaling problem made visible
3. **SFU architecture** — how a media server changes the topology

Each concept uses:
- Real browser WebRTC APIs (not simulations)
- Inspectable connection stats via `RTCPeerConnection.getStats()`
- 3D visualizations of network topology (Three.js / React Three Fiber)
- Blender-created assets exported as GLB/glTF
- Packet captures for protocol details not exposed by browser JS

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | React | 19.x |
| Language | TypeScript | 6.x |
| Build | Vite | 8.x |
| 3D | Three.js / React Three Fiber | Planned |
| 3D Assets | Blender → GLB/glTF | Planned |
| Signaling | Node.js WebSocket server | Planned |
| WebRTC | Browser APIs | Native |
| Linting | oxlint | 1.x |
| Testing | Vitest | Configured |

## Setup

```bash
# Clone and install
cd visible
npm install

# Copy environment config
cp .env.example .env

# Start dev server
npm run dev

# Build for production
npm run build

# Run linter
npm run lint

# Run tests
npm test

# Type check
npm run typecheck
```

## Project Structure

```
visible/
├── public/                  # Static assets served as-is
│   └── assets/              # Exported 3D models (GLB/glTF)
├── src/
│   ├── components/          # Reusable React components
│   ├── pages/               # Route-level page components
│   ├── services/            # WebRTC, signaling, data services
│   ├── hooks/               # Custom React hooks
│   ├── types/               # Shared TypeScript type definitions
│   ├── utils/               # Pure utility functions
│   ├── assets/              # Images, icons, bundled assets
│   │   └── models/          # 3D model source references
│   ├── App.tsx              # Root application component
│   └── main.tsx             # Application entry point
├── tests/                   # Test files
├── docs/
│   ├── architecture/        # System design, ADRs
│   ├── api/                 # API reference documentation
│   ├── engineering/         # Testing, security, deployment docs
│   └── learning/            # Concepts, logs, debugging lessons
├── .env.example             # Environment variable template
├── vite.config.ts           # Vite configuration
├── tsconfig.json            # TypeScript project references
└── package.json             # Dependencies and scripts
```

## Prerequisites

### Required
- Node.js 24.x
- npm 11.x
- Git 2.x
- A WebRTC-capable browser (Safari available; Chrome recommended)

### Recommended
- **Google Chrome** — `chrome://webrtc-internals` for debugging
- **Blender 4.x** — 3D asset creation (exported as GLB/glTF)
- **Wireshark** — packet-level WebRTC protocol inspection

### Not Yet Installed (from Phase 00A audit)
- Blender — required for 3D asset pipeline
- Chrome — recommended for WebRTC debugging
- Wireshark — optional for deep protocol analysis

## Development Workflow

1. Work inside `visible/` only — never modify sibling projects
2. Parent `.clinerules/` provides engineering role instructions
3. All commits stay in `visible/.git`
4. 3D assets: create in Blender → export GLB/glTF → place in `public/assets/`
5. WebRTC experiments use real browser APIs — clearly label simulated vs. real data

## Content Principles

- **Real over simulated**: use actual WebRTC connections, not mock data
- **Observable**: expose stats, events, and state transitions the user can inspect
- **Honest labeling**: clearly distinguish real observations, derived information, and simulations
- **Progressive**: start simple (1:1 P2P), build to complex (SFU)

## Current Limitations

- No 3D assets yet (Blender not installed)
- Single browser available (Safari) — cross-browser P2P testing limited
- No signaling server yet (planned for Phase 01)
- No packet capture tooling (Wireshark not installed)
- Minimal smoke test configured
