import { describe, expect, it } from 'vitest';

import { numberFieldMessage } from '@/utils/numberFieldMessage';

describe('numberFieldMessage', () => {
  it('says nothing for a valid value', () => {
    expect(numberFieldMessage('valid', 1, 30)).toBe('');
  });

  it('asks for a number when the field is empty', () => {
    expect(numberFieldMessage('empty', 1, 30)).toBe('Enter a number.');
  });

  it('names both ends of the range when there are two', () => {
    expect(numberFieldMessage('below', 1, 30)).toBe(
      'Enter a number from 1 to 30.'
    );
    expect(numberFieldMessage('above', 1, 30)).toBe(
      'Enter a number from 1 to 30.'
    );
  });

  it('names the one end when there is only one', () => {
    expect(numberFieldMessage('below', 0)).toBe('Enter 0 or more.');
    expect(numberFieldMessage('above', undefined, 20)).toBe(
      'Enter 20 or less.'
    );
  });
});
