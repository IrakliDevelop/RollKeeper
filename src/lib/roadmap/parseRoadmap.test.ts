import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { parseRoadmap, roadmapSection } from './parseRoadmap';

describe('parseRoadmap', () => {
  it('reads sections in file order with their items', () => {
    const roadmap = parseRoadmap(
      [
        '# Title',
        '',
        '## Built',
        '- One',
        '- Two',
        '',
        '## Next',
        '- Three',
      ].join('\n')
    );
    expect(roadmap.sections).toEqual([
      { heading: 'Built', items: [{ text: 'One' }, { text: 'Two' }] },
      { heading: 'Next', items: [{ text: 'Three' }] },
    ]);
  });

  it('keeps the URL of an item that is a single link', () => {
    const { sections } = parseRoadmap(
      '## Next\n- [Fog of war](/docs/fog)\n- Plain [inline](/x) text'
    );
    expect(sections[0].items).toEqual([
      { text: 'Fog of war', href: '/docs/fog' },
      { text: 'Plain [inline](/x) text' },
    ]);
  });

  it('ignores comments, prose, items before any section and empty items', () => {
    const { sections } = parseRoadmap(
      [
        '- orphan',
        '<!--',
        '## Hidden',
        '- hidden item',
        '-->',
        '<!-- one line -->',
        '## Later',
        'Some prose.',
        '-  ',
        '- Kept',
      ].join('\r\n')
    );
    expect(sections).toEqual([{ heading: 'Later', items: [{ text: 'Kept' }] }]);
  });

  it('finds a section by its exact heading', () => {
    const roadmap = parseRoadmap('## Next\n- A\n## Next steps\n- B');
    expect(roadmapSection(roadmap, 'Next')).toEqual([{ text: 'A' }]);
    expect(roadmapSection(roadmap, 'Missing')).toEqual([]);
  });

  it('parses the real roadmap with a non-empty Next section', () => {
    const file = readFileSync(
      path.join(process.cwd(), 'content', 'roadmap.md'),
      'utf8'
    );
    const roadmap = parseRoadmap(file);
    expect(roadmap.sections.map(s => s.heading)).toEqual([
      'Built',
      'In progress',
      'Next',
      'Later',
      'Not built yet',
    ]);
    expect(roadmapSection(roadmap, 'Next').length).toBeGreaterThan(0);
  });
});
