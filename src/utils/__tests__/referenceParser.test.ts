import { describe, it, expect } from 'vitest';
import {
  parseReferences,
  getPlainText,
  hasReferences,
  getFormattedHtml,
  extractReferences,
  formatSpellDescriptionForEditor,
} from '@/utils/referenceParser';

describe('parseReferences', () => {
  it('parses a single spell reference', () => {
    const result = parseReferences('{@spell Fireball|PHB}');
    expect(result.references).toHaveLength(1);
    const ref = result.references[0];
    expect(ref.type).toBe('spell');
    expect(ref.name).toBe('Fireball');
    expect(ref.source).toBe('PHB');
    expect(ref.displayText).toBe('Fireball');
    expect(ref.isReference).toBe(true);
  });

  it('parses a spell reference without source', () => {
    const result = parseReferences('{@spell Magic Missile}');
    expect(result.references).toHaveLength(1);
    expect(result.references[0].name).toBe('Magic Missile');
    expect(result.references[0].source).toBeUndefined();
  });

  it('returns original text in .text field', () => {
    const input = 'Cast {@spell Fireball|PHB} at the enemy.';
    const result = parseReferences(input);
    expect(result.text).toBe(input);
  });

  it('produces HTML output with spell replaced', () => {
    const result = parseReferences('Cast {@spell Fireball|PHB} now.');
    expect(result.html).not.toContain('{@spell');
    expect(result.html).toContain('Fireball');
  });

  it('handles mixed text with multiple reference types', () => {
    const result = parseReferences(
      '{@spell Fireball|PHB} deals {@damage 8d6} fire damage, DC {@dc 15} Dexterity saving throw.'
    );
    expect(result.references).toHaveLength(3);
    const types = result.references.map(r => r.type);
    expect(types).toContain('spell');
    expect(types).toContain('damage');
    expect(types).toContain('dc');
  });

  it('returns empty references array for plain text with no references', () => {
    const result = parseReferences('Just plain text here.');
    expect(result.references).toHaveLength(0);
    expect(result.html).toBe('Just plain text here.');
  });

  it('handles empty string', () => {
    const result = parseReferences('');
    expect(result.references).toHaveLength(0);
    expect(result.html).toBe('');
    expect(result.text).toBe('');
  });

  it('handles null/undefined gracefully', () => {
    // @ts-expect-error testing edge case
    const result = parseReferences(null);
    expect(result.references).toHaveLength(0);
  });

  it('parses dc reference and formats display text', () => {
    const result = parseReferences('{@dc 15}');
    expect(result.references[0].type).toBe('dc');
    expect(result.references[0].displayText).toBe('DC 15');
  });

  it('parses hit reference and formats display text', () => {
    const result = parseReferences('{@hit 7}');
    expect(result.references[0].type).toBe('hit');
    expect(result.references[0].displayText).toBe('+7');
  });

  it('parses atk reference for melee weapon attack', () => {
    const result = parseReferences('{@atk mw}');
    expect(result.references[0].type).toBe('atk');
    expect(result.references[0].displayText).toBe('Melee Weapon Attack:');
  });

  it('parses atk reference for ranged weapon attack', () => {
    const result = parseReferences('{@atk rw}');
    expect(result.references[0].type).toBe('atk');
    expect(result.references[0].displayText).toBe('Ranged Weapon Attack:');
  });

  it('parses condition reference', () => {
    const result = parseReferences('{@condition poisoned}');
    expect(result.references[0].type).toBe('condition');
    expect(result.references[0].name).toBe('poisoned');
  });

  it('parses creature reference', () => {
    const result = parseReferences('{@creature goblin}');
    expect(result.references[0].type).toBe('creature');
    expect(result.references[0].name).toBe('goblin');
  });

  it('handles unknown reference types as unknown', () => {
    const result = parseReferences('{@foobar something}');
    expect(result.references[0].type).toBe('unknown');
  });

  it('parses scaledamage reference', () => {
    const result = parseReferences('{@scaledamage 8d6|3-9|1d6}');
    expect(result.references[0].type).toBe('scaledamage');
    // Display text should include both base and scaling info
    expect(result.references[0].displayText).toContain('8d6');
  });

  it('parses actsave reference', () => {
    const result = parseReferences('{@actSave dex}');
    expect(result.references[0].type).toBe('actSave');
    expect(result.references[0].displayText).toBe('DEX save');
  });
});

describe('getPlainText', () => {
  it('strips reference tags and returns plain text', () => {
    const plain = getPlainText('{@spell Fireball|PHB}');
    expect(plain).not.toContain('{@');
    expect(plain).not.toContain('<');
    expect(plain).toContain('Fireball');
  });

  it('returns plain text unchanged if no references', () => {
    expect(getPlainText('Just text.')).toBe('Just text.');
  });

  it('strips all HTML tags from the formatted output', () => {
    const plain = getPlainText('Cast {@damage 8d6} fire damage.');
    expect(plain).not.toMatch(/<[^>]*>/);
    expect(plain).toContain('8d6');
  });
});

describe('hasReferences', () => {
  it('returns true when text contains {@...} references', () => {
    expect(hasReferences('{@spell Fireball|PHB}')).toBe(true);
    expect(hasReferences('Some text with {@dc 15} inside.')).toBe(true);
  });

  it('returns false for plain text', () => {
    expect(hasReferences('Just plain text.')).toBe(false);
    expect(hasReferences('')).toBe(false);
  });

  it('returns false for partial-looking but non-reference patterns', () => {
    expect(hasReferences('no references here')).toBe(false);
  });
});

describe('getFormattedHtml', () => {
  it('returns HTML string with references converted to spans', () => {
    const html = getFormattedHtml('{@spell Fireball|PHB}');
    expect(html).toContain('<span');
    expect(html).toContain('Fireball');
    expect(html).not.toContain('{@spell');
  });

  it('returns plain text as-is when no references present', () => {
    expect(getFormattedHtml('No references.')).toBe('No references.');
  });

  it('preserves surrounding text', () => {
    const html = getFormattedHtml('Deals {@damage 8d6} damage.');
    expect(html).toContain('Deals');
    expect(html).toContain('damage.');
    expect(html).toContain('8d6');
  });
});

describe('extractReferences', () => {
  it('returns array of parsed references', () => {
    const refs = extractReferences(
      '{@spell Fireball|PHB} and {@spell Ice Storm}'
    );
    expect(refs).toHaveLength(2);
    expect(refs[0].name).toBe('Fireball');
    expect(refs[1].name).toBe('Ice Storm');
  });

  it('returns empty array when no references', () => {
    expect(extractReferences('plain text')).toHaveLength(0);
  });
});

describe('formatSpellDescriptionForEditor', () => {
  it('converts references to bold text', () => {
    const result = formatSpellDescriptionForEditor('{@spell Fireball|PHB}');
    expect(result).toContain('<strong>');
    expect(result).toContain('Fireball');
    expect(result).not.toContain('{@spell');
  });

  it('returns empty string for empty input', () => {
    expect(formatSpellDescriptionForEditor('')).toBe('');
  });

  it('wraps plain paragraphs in <p> tags', () => {
    const result = formatSpellDescriptionForEditor(
      'First paragraph.\n\nSecond paragraph.'
    );
    expect(result).toContain('<p>');
    expect(result).toContain('First paragraph.');
    expect(result).toContain('Second paragraph.');
  });

  it('does not double-wrap already-tagged content', () => {
    const result = formatSpellDescriptionForEditor('<p>Already wrapped.</p>');
    expect(result).toContain('Already wrapped.');
    // Should not create <p><p>...
    expect(result).not.toContain('<p><p>');
  });
});
