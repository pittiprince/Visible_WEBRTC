import { describe, it, expect } from 'vitest';
import {
  parseCandidateType,
  calculateBitrate,
  formatBitrate,
  getProvenanceBadge,
} from '../src/services/webrtc.js';

describe('WebRTC Service Utilities', () => {
  describe('parseCandidateType', () => {
    it('identifies host candidate', () => {
      const line = 'candidate:1 1 UDP 2130706431 192.168.1.100 54321 typ host';
      expect(parseCandidateType(line)).toBe('host');
    });

    it('identifies srflx candidate', () => {
      const line = 'candidate:2 1 UDP 1694498815 203.0.113.1 54321 typ srflx raddr 192.168.1.100 rport 54321';
      expect(parseCandidateType(line)).toBe('srflx');
    });

    it('identifies relay candidate', () => {
      const line = 'candidate:3 1 UDP 8421375 198.51.100.1 3478 typ relay raddr 203.0.113.1 rport 54321';
      expect(parseCandidateType(line)).toBe('relay');
    });

    it('defaults to host when typ is missing', () => {
      expect(parseCandidateType('malformed candidate')).toBe('host');
    });
  });

  describe('calculateBitrate', () => {
    it('calculates bps correctly', () => {
      // 1000 bytes over 1 second = 8000 bps
      expect(calculateBitrate(2000, 1000, 1)).toBe(8000);
    });

    it('handles zero interval gracefully', () => {
      expect(calculateBitrate(2000, 1000, 0)).toBe(0);
    });

    it('handles negative interval gracefully', () => {
      expect(calculateBitrate(2000, 1000, -1)).toBe(0);
    });
  });

  describe('formatBitrate', () => {
    it('formats Mbps', () => {
      expect(formatBitrate(2_500_000)).toBe('2.50 Mbps');
    });

    it('formats kbps', () => {
      expect(formatBitrate(128_000)).toBe('128.0 kbps');
    });

    it('formats bps', () => {
      expect(formatBitrate(500)).toBe('500 bps');
    });
  });

  describe('getProvenanceBadge', () => {
    it('returns correct label and color for real', () => {
      expect(getProvenanceBadge('real')).toEqual({ label: 'REAL', color: '#22c55e' });
    });

    it('returns correct label and color for derived', () => {
      expect(getProvenanceBadge('derived')).toEqual({ label: 'DERIVED', color: '#3b82f6' });
    });

    it('returns correct label and color for simulation', () => {
      expect(getProvenanceBadge('simulation')).toEqual({ label: 'SIMULATION', color: '#f59e0b' });
    });
  });
});
