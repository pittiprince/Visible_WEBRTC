// WebRTC Service Stub — manages RTCPeerConnection lifecycle
// Exposes real browser events and stats for educational inspection.

import type { DiscoveredCandidate, ICECandidateType, Provenance } from '../types/webrtc.js';

export function parseCandidateType(candidateStr: string): ICECandidateType {
  const match = candidateStr.match(/typ\s+(host|srflx|prflx|relay)/);
  if (match && match[1]) {
    return match[1] as ICECandidateType;
  }
  return 'host';
}

export function parseCandidate(candidate: RTCIceCandidate): DiscoveredCandidate {
  const type = parseCandidateType(candidate.candidate);
  return {
    candidate: candidate.candidate,
    sdpMid: candidate.sdpMid,
    sdpMLineIndex: candidate.sdpMLineIndex,
    type,
    protocol: (candidate.protocol as 'udp' | 'tcp') || 'udp',
    ip: candidate.address || 'unknown',
    port: candidate.port || 0,
    priority: candidate.priority || 0,
  };
}

export function calculateBitrate(
  currentBytes: number,
  previousBytes: number,
  intervalSeconds: number
): number {
  if (intervalSeconds <= 0) return 0;
  return Math.round(((currentBytes - previousBytes) * 8) / intervalSeconds);
}

export function formatBitrate(bitsPerSecond: number): string {
  if (bitsPerSecond >= 1_000_000) {
    return `${(bitsPerSecond / 1_000_000).toFixed(2)} Mbps`;
  }
  if (bitsPerSecond >= 1_000) {
    return `${(bitsPerSecond / 1_000).toFixed(1)} kbps`;
  }
  return `${bitsPerSecond} bps`;
}

export function getProvenanceBadge(provenance: Provenance): {
  label: string;
  color: string;
} {
  switch (provenance) {
    case 'real':
      return { label: 'REAL', color: '#22c55e' };
    case 'derived':
      return { label: 'DERIVED', color: '#3b82f6' };
    case 'simulation':
      return { label: 'SIMULATION', color: '#f59e0b' };
  }
}
