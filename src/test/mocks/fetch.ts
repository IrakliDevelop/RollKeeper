import { vi } from 'vitest';

export function mockFetchResponse(status: number, body: unknown) {
  const fn = vi.fn(() =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    })
  ) as unknown as typeof global.fetch;

  global.fetch = fn;
  return fn;
}

export function mockFetchSequence(
  responses: Array<{ status: number; body: unknown }>
) {
  let callIndex = 0;
  const fn = vi.fn(() => {
    const resp = responses[Math.min(callIndex, responses.length - 1)];
    callIndex++;
    return Promise.resolve({
      ok: resp.status >= 200 && resp.status < 300,
      status: resp.status,
      json: () => Promise.resolve(resp.body),
    });
  }) as unknown as typeof global.fetch;

  global.fetch = fn;
  return fn;
}

export function resetFetch() {
  global.fetch = vi.fn(() =>
    Promise.reject(new Error('fetch not mocked'))
  ) as unknown as typeof global.fetch;
}
