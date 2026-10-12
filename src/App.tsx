import './App.css';
import { getProvenanceBadge } from './services/webrtc.js';
import type { Provenance } from './types/webrtc.js';

function ProvenanceTag({ type }: { type: Provenance }) {
  const badge = getProvenanceBadge(type);
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: '4px',
        fontSize: '0.75rem',
        fontWeight: 600,
        backgroundColor: `${badge.color}20`,
        color: badge.color,
        border: `1px solid ${badge.color}40`,
        marginRight: '6px',
      }}
    >
      {badge.label}
    </span>
  );
}

function App() {
  return (
    <main style={{ maxWidth: '960px', margin: '0 auto', padding: '2rem 1rem', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ marginBottom: '2.5rem' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem', color: '#111827' }}>Visible</h1>
        <p style={{ fontSize: '1.25rem', color: '#4b5563', margin: 0 }}>
          Making complex technology understandable through real data, interactive 3D, and live experiments.
        </p>
      </header>

      <section style={{ marginBottom: '2rem', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
        <h2 style={{ fontSize: '1.25rem', marginTop: 0 }}>Module 01: WebRTC Under the Hood</h2>
        <p style={{ color: '#4b5563' }}>
          Explore peer-to-peer browser communication. Real connections, inspectable ICE candidates, and live statistics.
        </p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '1rem' }}>
          <ProvenanceTag type="real" />
          <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Native browser RTCPeerConnection APIs</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '0.5rem' }}>
          <ProvenanceTag type="derived" />
          <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Calculated bitrates, packet loss trends</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '0.5rem' }}>
          <ProvenanceTag type="simulation" />
          <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Network topology models where browser APIs end</span>
        </div>
      </section>

      <section style={{ padding: '1.5rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
        <h2 style={{ fontSize: '1.25rem', marginTop: 0 }}>Project Status</h2>
        <ul style={{ color: '#4b5563', lineHeight: 1.8 }}>
          <li>✅ Phase 00A: Environment audit complete</li>
          <li>✅ Phase 00B: Project scaffolded (React 19 + TypeScript + Vite + Vitest)</li>
          <li>⏳ Phase 01: Signaling server & 1:1 WebRTC peer connection lab (next)</li>
        </ul>
      </section>
    </main>
  );
}

export default App;
