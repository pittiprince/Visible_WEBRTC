import type {
  ICECandidateType,
  DiscoveredCandidate,
  Provenance,
} from '../types/webrtc.ts';

/**
 * WebRTCConnectionManager - minimal lifecycle for a single peer connection.
 */
export class WebRTCConnectionManager {
  private pc: RTCPeerConnection;
  private listeners: Map<string, Set<Function>> = new Map();
  private closed: boolean = false;

  constructor(config?: RTCConfiguration) {
    this.pc = new RTCPeerConnection(config);
    this.setupListeners();
  }

  private setupListeners() {
    this.pc.onconnectionstatechange = () => {
      if (!this.closed) {
        this.emit('connectionStateChange', this.pc.connectionState);
      }
    };
    this.pc.oniceconnectionstatechange = () => {
      if (!this.closed) {
        this.emit('iceConnectionStateChange', this.pc.iceConnectionState);
      }
    };
    this.pc.onsignalingstatechange = () => {
      if (!this.closed) {
        this.emit('signalingStateChange', this.pc.signalingState);
      }
    };
  }

  public on(event: 'connectionStateChange' | 'iceConnectionStateChange' | 'signalingStateChange', listener: (state: any) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
  }

  public off(event: string, listener: Function) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.delete(listener);
      if (listeners.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  public close() {
    if (this.closed) return;
    this.closed = true;
    // Remove listeners to prevent memory leaks and stop callbacks
    this.pc.onconnectionstatechange = null;
    this.pc.oniceconnectionstatechange = null;
    this.pc.onsignalingstatechange = null;
    if (this.pc.signalingState !== 'closed') {
      this.pc.close();
    }
    this.listeners.clear();
  }

  private emit(event: string, arg: any) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(arg);
        } catch (e) {
          console.error(`Error in event listener for ${event}:`, e);
        }
      });
    }
  }
}

/* Re-export existing utilities for backward compatibility */
export function parseCandidateType(candidateStr: string): ICECandidateType {
  const parts = candidateStr.split(' ');
  const typIndex = parts.indexOf('typ');
  if (typIndex !== -1 && typIndex + 1 < parts.length) {
    const type = parts[typIndex + 1];
    if (['host', 'srflx', 'prflx', 'relay'].includes(type as ICECandidateType)) {
      return type as ICECandidateType;
    }
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
