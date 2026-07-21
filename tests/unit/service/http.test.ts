import { describe, expect, it } from 'vitest';
import { AppError, fromError } from '@/server/lib/http';

describe('AppError', () => {
  it('has correct properties', () => {
    const err = new AppError('NOT_FOUND', 'Entity not found', 404);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.message).toBe('Entity not found');
    expect(err.status).toBe(404);
    expect(err.name).toBe('AppError');
  });

  it('defaults status to 400', () => {
    const err = new AppError('INVALID_INPUT', 'Bad input');
    expect(err.status).toBe(400);
  });

  it('stores details', () => {
    const err = new AppError('INTERNAL', 'Failed', 500, { raw: 'error' });
    expect(err.details).toEqual({ raw: 'error' });
  });

  it('is an instance of Error', () => {
    const err = new AppError('CONFLICT', 'Conflict', 409);
    expect(err instanceof Error).toBe(true);
    expect(err instanceof AppError).toBe(true);
  });
});

describe('fromError', () => {
  it('handles AppError', async () => {
    const err = new AppError('NOT_FOUND', 'Not found', 404);
    const res = fromError(err);
    const body = await res.json();
    expect(res.status).toBe(404);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('handles unknown error', async () => {
    const res = fromError(new Error('unexpected'));
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('INTERNAL');
  });

  it('handles Zod-like error', async () => {
    const zodErr = { name: 'ZodError', issues: [{ path: ['field'], message: 'Invalid input' }] };
    const res = fromError(zodErr);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('INVALID_INPUT');
  });
});
