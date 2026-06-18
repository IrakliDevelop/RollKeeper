import { describe, it, expect, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from './middleware';

describe('middleware dev-route gating', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 404 for a dev-only route in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const res = middleware(new NextRequest('http://localhost/dice-test'));
    expect(res.status).toBe(404);
  });

  it('returns 404 for a nested dev-only path in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const res = middleware(
      new NextRequest('http://localhost/design-system/buttons')
    );
    expect(res.status).toBe(404);
  });

  it('allows dev-only routes outside production', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const res = middleware(new NextRequest('http://localhost/dice-test'));
    expect(res.status).toBe(200);
  });
});
