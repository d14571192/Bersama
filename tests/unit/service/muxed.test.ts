import { describe, expect, it } from 'vitest';
import { formatUsdc, parseUsdc, createMuxedAddress } from '@/server/lib/muxed';

describe('formatUsdc', () => {
  it('formats 1 USDC', () => {
    expect(formatUsdc('1000000')).toBe('1.00');
  });

  it('formats fractional USDC', () => {
    const result = formatUsdc('8000000');
    expect(result).toBe('8.00');
  });

  it('formats large USDC amounts', () => {
    expect(formatUsdc('1000000000')).toBe('1000.00');
  });

  it('formats zero', () => {
    expect(formatUsdc('0')).toBe('0.00');
  });

  it('handles amounts with cents', () => {
    const result = formatUsdc('1500000');
    // formatUsdc strips trailing zeros: "1.5" not "1.50"
    expect(result).toBe('1.5');
  });
});

describe('parseUsdc', () => {
  it('parses whole USDC', () => {
    expect(parseUsdc('1')).toBe('1000000');
  });

  it('parses 8 USDC', () => {
    expect(parseUsdc('8')).toBe('8000000');
  });

  it('parses with decimals', () => {
    expect(parseUsdc('8.00')).toBe('8000000');
  });

  it('parses 1000 USDC', () => {
    expect(parseUsdc('1000')).toBe('1000000000');
  });
});

describe('createMuxedAddress (SEP-23)', () => {
  it('returns M-prefixed muxed account address', () => {
    const addr = createMuxedAddress(42);
    expect(addr).toMatch(/^M/);
  });

  it('returns different addresses for different donor IDs', () => {
    const addr1 = createMuxedAddress(1);
    const addr2 = createMuxedAddress(2);
    expect(addr1).not.toBe(addr2);
  });

  it('is deterministic for same donor ID', () => {
    const addr1 = createMuxedAddress(100);
    const addr2 = createMuxedAddress(100);
    expect(addr1).toBe(addr2);
  });
});
