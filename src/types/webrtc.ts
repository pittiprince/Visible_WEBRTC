// WebRTC Connection States and Event Types for Visible

export type WebRTCConnectionState =
  | 'new'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'failed'
  | 'closed';

export type ICEConnectionState =
  | 'new'
  | 'checking'
  | 'connected'
  | 'completed'
  | 'failed'
  | 'disconnected'
  | 'closed';

export type SignalingState =
  | 'stable'
  | 'have-local-offer'
  | 'have-remote-offer'
  | 'have-local-pranswer'
  | 'have-remote-pranswer'
  | 'closed';

export type ICECandidateType = 'host' | 'srflx' | 'prflx' | 'relay';

export interface DiscoveredCandidate {
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
  type: ICECandidateType;
  protocol: 'udp' | 'tcp';
  ip: string;
  port: number;
  priority: number;
}

export type Provenance = 'real' | 'derived' | 'simulation';

export interface DataPoint<T> {
  value: T;
  provenance: Provenance;
  timestamp: number;
}

export interface ConnectionStats {
  bytesReceived: DataPoint<number>;
  bytesSent: DataPoint<number>;
  packetsReceived: DataPoint<number>;
  packetsLost: DataPoint<number>;
  roundTripTime: DataPoint<number>;
  currentRoundTripTime: DataPoint<number>;
  availableOutgoingBitrate: DataPoint<number>;
  calculatedBitrate: DataPoint<number>; // derived
}

export interface SignalingMessage {
  type: 'offer' | 'answer' | 'candidate' | 'join' | 'leave';
  roomId: string;
  senderId: string;
  payload: unknown;
  timestamp: number;
}
