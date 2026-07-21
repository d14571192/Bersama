import { EventEmitter } from 'node:events';

export type DonationMatchEvent = {
  donationId: string;
  poolId: string;
  donorName: string;
  amountMinor: string;
  matchedAmountMinor: string;
  totalImpactMinor: string;
  status: string;
  occurredAt: Date;
};

export type PoolUpdateEvent = {
  poolId: string;
  remainingMinor: string;
  matchedMinor: string;
  status: string;
  occurredAt: Date;
};

export type EventMap = {
  'donation.matched': DonationMatchEvent;
  'pool.updated': PoolUpdateEvent;
};

type Topic = keyof EventMap;

class TypedBus {
  private readonly emitter = new EventEmitter();
  private readonly counts = new Map<Topic, number>();

  constructor() {
    this.emitter.setMaxListeners(1000);
  }

  publish<T extends Topic>(topic: T, payload: EventMap[T]): void {
    setImmediate(() => this.emitter.emit(topic, payload));
  }

  subscribe<T extends Topic>(
    topic: T,
    callback: (payload: EventMap[T]) => void,
    signal?: AbortSignal,
  ): () => void {
    this.emitter.on(topic, callback as (...args: unknown[]) => void);
    const count = (this.counts.get(topic) ?? 0) + 1;
    this.counts.set(topic, count);
    const unsubscribe = () => {
      this.emitter.off(topic, callback as (...args: unknown[]) => void);
      const next = (this.counts.get(topic) ?? 1) - 1;
      this.counts.set(topic, Math.max(0, next));
    };
    if (signal) {
      const onAbort = () => unsubscribe();
      if (signal.aborted) {
        unsubscribe();
      } else {
        signal.addEventListener('abort', onAbort, { once: true });
      }
    }
    return unsubscribe;
  }

  subscriberCount(topic: Topic): number {
    return this.counts.get(topic) ?? 0;
  }

  reset(): void {
    this.emitter.removeAllListeners();
    this.counts.clear();
  }
}

export const eventBus = new TypedBus();
