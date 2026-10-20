import type { NumberFieldValidity } from '@/hooks/useNumberField';

/**
 * The message announced while a number field holds a value it won't keep.
 * Empty for a valid value.
 */
export function numberFieldMessage(
  validity: NumberFieldValidity,
  min?: number,
  max?: number
): string {
  if (validity === 'valid') return '';
  if (validity === 'empty') return 'Enter a number.';
  if (min !== undefined && max !== undefined) {
    return `Enter a number from ${min} to ${max}.`;
  }
  return validity === 'below'
    ? `Enter ${min} or more.`
    : `Enter ${max} or less.`;
}
