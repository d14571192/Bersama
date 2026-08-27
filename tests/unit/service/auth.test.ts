import { describe, expect, it } from 'vitest';
import { isChallengeTransactionForPublicKey } from '@/server/service/auth.service';

describe('isChallengeTransactionForPublicKey', () => {
  it('accepts a transaction sourced by the wallet', () => {
    expect(
      isChallengeTransactionForPublicKey(
        { source: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5' },
        'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
      ),
    ).toBe(true);
  });

  it('rejects a transaction sourced by another account', () => {
    expect(
      isChallengeTransactionForPublicKey(
        { source: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF' },
        'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
      ),
    ).toBe(false);
  });
});
