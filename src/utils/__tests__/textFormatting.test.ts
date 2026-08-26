import { describe, it, expect } from 'vitest';
import {
  processDndText,
  markdownToHtml,
  processAndFormatDndText,
  createSafeHtml,
} from '@/utils/textFormatting';

describe('processDndText', () => {
  it('returns empty string for empty input', () => {
    expect(processDndText('')).toBe('');
  });

  it('converts {@dc XX} to "DC XX"', () => {
    expect(processDndText('{@dc 15}')).toBe('DC 15');
  });

  it('handles {@dc} with whitespace variations', () => {
    expect(processDndText('{@dc  20}')).toBe('DC 20');
  });

  it('strips {@damage} braces leaving the expression', () => {
    expect(processDndText('{@damage 2d6}')).toBe('2d6');
  });

  it('strips {@dice} braces leaving the expression', () => {
    expect(processDndText('{@dice 1d20}')).toBe('1d20');
  });

  it('extracts display name from {@spell Name|Source}', () => {
    expect(processDndText('{@spell Fireball|PHB}')).toBe('Fireball');
  });

  it('extracts display name from generic {@tag Name|Source} pattern', () => {
    expect(processDndText('{@condition Poisoned|PHB}')).toBe('Poisoned');
  });

  it('extracts display name from {@tag Name} without pipe', () => {
    expect(processDndText('{@item Longsword}')).toBe('Longsword');
  });

  it('processes multiple tokens in a string', () => {
    const input =
      'Make a {@dc 13} Constitution saving throw or take {@damage 1d6} poison damage.';
    const result = processDndText(input);
    expect(result).toBe(
      'Make a DC 13 Constitution saving throw or take 1d6 poison damage.'
    );
  });

  it('leaves plain text unchanged', () => {
    expect(processDndText('Just some plain text.')).toBe(
      'Just some plain text.'
    );
  });
});

describe('markdownToHtml', () => {
  it('returns empty string for empty input', () => {
    expect(markdownToHtml('')).toBe('');
  });

  it('converts **text** to <strong>text</strong>', () => {
    expect(markdownToHtml('**bold**')).toBe('<strong>bold</strong>');
  });

  it('converts multiple bold segments', () => {
    expect(markdownToHtml('**foo** and **bar**')).toBe(
      '<strong>foo</strong> and <strong>bar</strong>'
    );
  });

  it('leaves non-bold text unchanged', () => {
    expect(markdownToHtml('plain text')).toBe('plain text');
  });

  it('does not alter single asterisks', () => {
    expect(markdownToHtml('a*b*c')).toBe('a*b*c');
  });
});

describe('processAndFormatDndText', () => {
  it('applies both DnD text processing and markdown-to-HTML', () => {
    const input = '**{@dc 15}** check';
    const result = processAndFormatDndText(input);
    expect(result).toBe('<strong>DC 15</strong> check');
  });

  it('returns empty string for empty input', () => {
    expect(processAndFormatDndText('')).toBe('');
  });
});

describe('createSafeHtml', () => {
  it('returns an object with __html property', () => {
    const result = createSafeHtml('**bold** text');
    expect(result).toHaveProperty('__html');
  });

  it('the __html value is the processed and formatted text', () => {
    const result = createSafeHtml('**bold**');
    expect(result.__html).toBe('<strong>bold</strong>');
  });

  it('processes DnD tags within __html', () => {
    const result = createSafeHtml('{@dc 10}');
    expect(result.__html).toBe('DC 10');
  });
});
