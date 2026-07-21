import { describe, expect, it } from 'vitest';
import { formatUsdc, formatVnd, truncateKey } from '@/lib/utils';

describe('formatUsdc (client)', () => {
  it('formats 8 USDC', () => {
    expect(formatUsdc('8000000')).toBe('8.00');
  });

  it('formats 16 USDC', () => {
    expect(formatUsdc('16000000')).toBe('16.00');
  });

  it('formats zero', () => {
    expect(formatUsdc('0')).toBe('0.00');
  });

  it('formats 1000 USDC', () => {
    expect(formatUsdc('1000000000')).toBe('1000.00');
  });
});

describe('formatVnd', () => {
  it('converts 8 USDC to VND', () => {
    // 8 USDC * 25000 = 200,000 VND
    const result = formatVnd('8000000');
    expect(result).toContain('200');
  });

  it('converts 16 USDC to VND (persona total impact)', () => {
    // 16 USDC * 25000 = 400,000 VND
    const result = formatVnd('16000000');
    expect(result).toContain('400');
  });
});

describe('truncateKey', () => {
  it('truncates long keys', () => {
    const key = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
    const result = truncateKey(key);
    expect(result).toContain('…');
    expect(result.length).toBeLessThan(key.length);
  });

  it('returns short keys unchanged', () => {
    const key = 'GBBD47';
    expect(truncateKey(key)).toBe(key);
  });
});
