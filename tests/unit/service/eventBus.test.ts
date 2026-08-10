import { describe, expect, it, beforeEach } from 'vitest';
import { eventBus } from '@/server/lib/eventBus';

describe('eventBus', () => {
  beforeEach(() => {
    eventBus.reset();
  });

  it('publishes and receives donation.matched events', async () => {
    const received: unknown[] = [];
    eventBus.subscribe('donation.matched', (payload) => {
      received.push(payload);
    });

    eventBus.publish('donation.matched', {
      donationId: 'test-id',
      poolId: 'pool-id',
      donorName: 'Nguyen Thi Lan',
      amountMinor: '8000000',
      matchedAmountMinor: '8000000',
      totalImpactMinor: '16000000',
      status: 'matched',
      occurredAt: new Date(),
    });

    // Wait for setImmediate
    await new Promise((r) => setImmediate(r));
    expect(received).toHaveLength(1);
  });

  it('unsubscribes correctly', async () => {
    const received: unknown[] = [];
    const unsub = eventBus.subscribe('pool.updated', (payload) => {
      received.push(payload);
    });

    unsub();

    eventBus.publish('pool.updated', {
      poolId: 'pool-id',
      remainingMinor: '500000000',
      matchedMinor: '500000000',
      status: 'active',
      occurredAt: new Date(),
    });

    await new Promise((r) => setImmediate(r));
    expect(received).toHaveLength(0);
  });

  it('tracks subscriber count', () => {
    expect(eventBus.subscriberCount('donation.matched')).toBe(0);
    const unsub = eventBus.subscribe('donation.matched', () => {});
    expect(eventBus.subscriberCount('donation.matched')).toBe(1);
    unsub();
    expect(eventBus.subscriberCount('donation.matched')).toBe(0);
  });

  it('unsubscribes via AbortSignal', async () => {
    const received: unknown[] = [];
    const controller = new AbortController();

    eventBus.subscribe(
      'donation.matched',
      (payload) => {
        received.push(payload);
      },
      controller.signal,
    );

    controller.abort();

    eventBus.publish('donation.matched', {
      donationId: 'test-id',
      poolId: 'pool-id',
      donorName: 'Test',
      amountMinor: '1000000',
      matchedAmountMinor: '1000000',
      totalImpactMinor: '2000000',
      status: 'matched',
      occurredAt: new Date(),
    });

    await new Promise((r) => setImmediate(r));
    expect(received).toHaveLength(0);
  });
});
