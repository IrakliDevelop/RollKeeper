import { describe, it, expect, vi } from 'vitest';
import { attachConnectionScope } from '../connectionScope';

describe('attachConnectionScope', () => {
  it('on failure: runs every pushed cleanup in push order, stops the connection, rethrows the original error', () => {
    const order: string[] = [];
    const connection = { stop: vi.fn(() => order.push('stop')) };
    expect(() =>
      attachConnectionScope(connection, scope => {
        scope.push(() => order.push('a'));
        scope.push(() => {
          order.push('b');
          throw new Error('b cleanup boom'); // must not stop the unwind
        });
        scope.push(() => order.push('c'));
        throw new Error('attach boom');
      })
    ).toThrow('attach boom');
    expect(order).toEqual(['a', 'b', 'c', 'stop']);
  });

  it('on success: returns a composite cleanup that runs in push order, guards each step, never stops the connection, and is idempotent', () => {
    const order: string[] = [];
    const connection = { stop: vi.fn() };
    const cleanup = attachConnectionScope(connection, scope => {
      scope.push(() => order.push('a'));
      scope.push(() => {
        order.push('b');
        throw new Error('boom');
      });
      scope.push(() => order.push('c'));
    });
    expect(order).toEqual([]);
    cleanup();
    cleanup();
    expect(order).toEqual(['a', 'b', 'c']);
    expect(connection.stop).not.toHaveBeenCalled();
  });

  it('a throwing connection.stop during unwind still surfaces the original error', () => {
    const connection = {
      stop: vi.fn(() => {
        throw new Error('stop boom');
      }),
    };
    expect(() =>
      attachConnectionScope(connection, () => {
        throw new Error('attach boom');
      })
    ).toThrow('attach boom');
    expect(connection.stop).toHaveBeenCalledTimes(1);
  });
});
