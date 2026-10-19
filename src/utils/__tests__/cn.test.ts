import { describe, it, expect } from 'vitest';
import { cn } from '@/utils/cn';

describe('cn', () => {
  it('returns a single class name unchanged', () => {
    expect(cn('foo')).toBe('foo');
  });

  it('merges multiple class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('filters out falsy conditional values', () => {
    expect(cn('foo', false && 'bar', null, undefined, '')).toBe('foo');
  });

  it('includes a class when condition is true', () => {
    const isActive = true;
    expect(cn('base', isActive && 'active')).toBe('base active');
  });

  it('excludes a class when condition is false', () => {
    const isActive = false;
    expect(cn('base', isActive && 'active')).toBe('base');
  });

  it('handles object syntax for conditional classes', () => {
    expect(cn({ active: true, disabled: false })).toBe('active');
  });

  it('handles array syntax', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar');
  });

  it('resolves Tailwind padding conflict (last wins)', () => {
    // twMerge keeps the last conflicting utility
    expect(cn('p-4', 'p-2')).toBe('p-2');
  });

  it('resolves Tailwind text-color conflict', () => {
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });

  it('preserves non-conflicting utilities', () => {
    const result = cn('flex', 'items-center', 'p-4');
    expect(result).toContain('flex');
    expect(result).toContain('items-center');
    expect(result).toContain('p-4');
  });

  it('returns empty string when all inputs are falsy', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('returns empty string with no arguments', () => {
    expect(cn()).toBe('');
  });

  describe('type scale', () => {
    it('keeps the last type step', () => {
      expect(cn('type-heading', 'type-body')).toBe('type-body');
      expect(cn('type-num-lg', 'type-num-md')).toBe('type-num-md');
    });

    it('lets a type step replace an earlier size, weight and family', () => {
      expect(cn('text-sm font-bold font-sans leading-5', 'type-ui')).toBe(
        'type-ui'
      );
    });

    it('keeps a type step when a later class overrides one property', () => {
      expect(cn('type-ui', 'text-lg')).toBe('type-ui text-lg');
      expect(cn('type-heading', 'font-semibold')).toBe(
        'type-heading font-semibold'
      );
    });

    it('keeps numeric variants and the text colour next to a type step', () => {
      expect(cn('type-num-md', 'tabular-nums', 'text-heading')).toBe(
        'type-num-md tabular-nums text-heading'
      );
    });
  });
});
