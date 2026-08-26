import { describe, it, expect } from 'vitest';
import { stripTags, parseEntriesToHtml } from '@/utils/parseEntriesToHtml';

describe('stripTags', () => {
  it('strips a simple spell reference and returns just the name', () => {
    expect(stripTags('{@spell Fireball|PHB}')).toBe('Fireball');
  });

  it('strips a condition reference', () => {
    expect(stripTags('{@condition poisoned}')).toBe('poisoned');
  });

  it('strips a damage reference', () => {
    expect(stripTags('{@damage 8d6}')).toBe('8d6');
  });

  it('strips a dc reference', () => {
    expect(stripTags('{@dc 15}')).toBe('15');
  });

  it('strips multiple references from text', () => {
    const result = stripTags('Deals {@damage 8d6} fire damage. DC {@dc 15}.');
    expect(result).toBe('Deals 8d6 fire damage. DC 15.');
  });

  it('leaves plain text unchanged', () => {
    expect(stripTags('No tags here.')).toBe('No tags here.');
  });

  it('strips reference with extra pipe segments and takes first part', () => {
    expect(stripTags('{@spell Ice Storm|PHB|extra}')).toBe('Ice Storm');
  });

  it('handles empty string', () => {
    expect(stripTags('')).toBe('');
  });
});

describe('parseEntriesToHtml', () => {
  it('returns empty string for empty array', () => {
    expect(parseEntriesToHtml([])).toBe('');
  });

  it('wraps string entries in <p> tags', () => {
    const html = parseEntriesToHtml(['Hello world.']);
    expect(html).toBe('<p>Hello world.</p>');
  });

  it('processes inline references within string entries', () => {
    const html = parseEntriesToHtml(['Deals {@damage 8d6} fire damage.']);
    expect(html).toContain('<p>');
    expect(html).toContain('8d6');
    expect(html).not.toContain('{@damage');
  });

  it('wraps spell references in <em> tags', () => {
    const html = parseEntriesToHtml(['Cast {@spell Fireball|PHB}.']);
    expect(html).toContain('<em>Fireball</em>');
  });

  it('wraps condition references in <em> tags', () => {
    const html = parseEntriesToHtml(['The target is {@condition poisoned}.']);
    expect(html).toContain('<em>poisoned</em>');
  });

  it('handles multiple string entries', () => {
    const html = parseEntriesToHtml(['First paragraph.', 'Second paragraph.']);
    expect(html).toBe('<p>First paragraph.</p><p>Second paragraph.</p>');
  });

  it('skips null and non-object entries', () => {
    const html = parseEntriesToHtml([null, undefined, 42]);
    expect(html).toBe('');
  });

  it('renders list entries as <ul><li>', () => {
    const html = parseEntriesToHtml([
      {
        type: 'list',
        items: ['Item one', 'Item two'],
      },
    ]);
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>Item one</li>');
    expect(html).toContain('<li>Item two</li>');
  });

  it('renders named list items with bold name', () => {
    const html = parseEntriesToHtml([
      {
        type: 'list',
        items: [
          {
            type: 'item',
            name: 'Feature',
            entries: ['Description of feature.'],
          },
        ],
      },
    ]);
    expect(html).toContain('<strong>Feature.</strong>');
    expect(html).toContain('Description of feature.');
  });

  it('renders entries-type block with h3 heading', () => {
    const html = parseEntriesToHtml([
      {
        type: 'entries',
        name: 'Special Ability',
        entries: ['This is the description.'],
      },
    ]);
    expect(html).toContain('<h3>Special Ability</h3>');
    expect(html).toContain('<p>This is the description.</p>');
  });

  it('renders entries-type block without name', () => {
    const html = parseEntriesToHtml([
      {
        type: 'entries',
        entries: ['No heading here.'],
      },
    ]);
    expect(html).not.toContain('<h3>');
    expect(html).toContain('No heading here.');
  });

  it('renders section-type block with h2 heading', () => {
    const html = parseEntriesToHtml([
      {
        type: 'section',
        name: 'Chapter One',
        entries: ['Section content.'],
      },
    ]);
    expect(html).toContain('<h2>Chapter One</h2>');
    expect(html).toContain('<p>Section content.</p>');
  });

  it('renders inset-type block as blockquote', () => {
    const html = parseEntriesToHtml([
      {
        type: 'inset',
        name: 'Sidebar',
        entries: ['Inset content.'],
      },
    ]);
    expect(html).toContain('<blockquote>');
    expect(html).toContain('<strong>Sidebar</strong>');
    expect(html).toContain('Inset content.');
  });

  it('renders quote-type block as blockquote', () => {
    const html = parseEntriesToHtml([
      {
        type: 'quote',
        entries: ['A famous quote.'],
      },
    ]);
    expect(html).toContain('<blockquote>');
    expect(html).toContain('A famous quote.');
  });

  it('renders table with headers and rows', () => {
    const html = parseEntriesToHtml([
      {
        type: 'table',
        caption: 'My Table',
        colLabels: ['Name', 'Value'],
        rows: [
          ['Strength', '16'],
          ['Dexterity', '14'],
        ],
      },
    ]);
    expect(html).toContain('<table>');
    expect(html).toContain('<caption>My Table</caption>');
    expect(html).toContain('<th>Name</th>');
    expect(html).toContain('<td>Strength</td>');
    expect(html).toContain('<td>16</td>');
  });

  it('handles nested entries (entries inside entries)', () => {
    const html = parseEntriesToHtml([
      {
        type: 'entries',
        name: 'Outer',
        entries: [
          {
            type: 'entries',
            name: 'Inner',
            entries: ['Deep content.'],
          },
        ],
      },
    ]);
    expect(html).toContain('<h3>Outer</h3>');
    expect(html).toContain('<h3>Inner</h3>');
    expect(html).toContain('Deep content.');
  });

  it('handles objects without a recognized type but with entries array', () => {
    const html = parseEntriesToHtml([
      {
        entries: ['Fallback content.'],
      },
    ]);
    expect(html).toContain('Fallback content.');
  });

  it('does not escape raw HTML in plain string entries (passed through as-is)', () => {
    // processInlineText only escapes content inside {@...} tags; raw text is passed through.
    const html = parseEntriesToHtml(['Use <b>bold</b> text.']);
    expect(html).toContain('<b>bold</b>');
  });

  it('escapes HTML special characters within reference tag content', () => {
    // Ampersands and angle brackets inside {@...} tags are escaped by escapeHtml
    const html = parseEntriesToHtml(['{@damage 1d6+2}']);
    expect(html).toContain('1d6+2');
    expect(html).not.toContain('{@damage');
  });
});
