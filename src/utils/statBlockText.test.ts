import { describe, expect, test } from 'vitest';

import {
  parseAttackTokens,
  plainTextToBadgedHtml,
  renderStatBlockEntryText,
  replaceDamage,
  replaceToHit,
  statBlockHtmlToPlainText,
} from './statBlockText';

// Real-world sample copied from an actual zombie stat block render
// (produced by `parseReferences` / `formatReferenceHtml`).
const ZOMBIE_HTML =
  '<span class="inline-flex items-center gap-1 px-2 py-1 rounded text-sm font-medium transition-colors bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/20" title="Melee Weapon Attack:">⚔️ Melee Weapon Attack:</span> <span class="inline-flex items-center gap-1 px-2 py-1 rounded text-sm font-medium transition-colors bg-emerald-600/10 text-emerald-400 border border-emerald-600/20 hover:bg-emerald-600/20" title="+3">🎯 +3</span> to hit, reach 5 ft., one target. 4 (<span class="inline-flex items-center gap-1 px-2 py-1 rounded text-sm font-medium transition-colors bg-red-600/10 text-red-400 border border-red-600/20 hover:bg-red-600/20" title="1d6 + 1">💥 1d6 + 1</span>) bludgeoning damage.';

const ZOMBIE_PLAIN =
  'Melee Weapon Attack: +3 to hit, reach 5 ft., one target. 4 (1d6 + 1) bludgeoning damage.';

describe('statBlockHtmlToPlainText', () => {
  test('converts the real zombie badge-span sample to plain text', () => {
    expect(statBlockHtmlToPlainText(ZOMBIE_HTML)).toBe(ZOMBIE_PLAIN);
  });

  test('returns plain input unchanged', () => {
    expect(statBlockHtmlToPlainText(ZOMBIE_PLAIN)).toBe(ZOMBIE_PLAIN);
  });

  test('decodes basic HTML entities and collapses whitespace', () => {
    const html =
      'Tom &amp; Jerry\n  fight   &lt;here&gt; &quot;now&quot; &#39;ok&#39;';
    expect(statBlockHtmlToPlainText(html)).toBe(
      'Tom & Jerry fight <here> "now" \'ok\''
    );
  });

  test('strips unrecognized tags', () => {
    expect(statBlockHtmlToPlainText('<p>Hello <b>world</b></p>')).toBe(
      'Hello world'
    );
  });

  test('drops only the leading emoji token inside a badge span', () => {
    const html = '<span class="foo" title="+3">🎯 +3</span> to hit';
    expect(statBlockHtmlToPlainText(html)).toBe('+3 to hit');
  });

  test('does not drop the first word when the badge has no emoji icon', () => {
    const html = '<span class="foo" title="Grapple">Grapple</span> attempt';
    expect(statBlockHtmlToPlainText(html)).toBe('Grapple attempt');
  });
});

describe('plainTextToBadgedHtml', () => {
  test('badges attack label, to-hit, and damage dice with correct classes/titles', () => {
    const result = plainTextToBadgedHtml(ZOMBIE_PLAIN);

    expect(result).toContain(
      'bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/20" title="Melee Weapon Attack:">⚔️ Melee Weapon Attack:</span>'
    );
    expect(result).toContain(
      'bg-emerald-600/10 text-emerald-400 border border-emerald-600/20 hover:bg-emerald-600/20" title="+3">🎯 +3</span>'
    );
    expect(result).toContain(
      'bg-red-600/10 text-red-400 border border-red-600/20 hover:bg-red-600/20" title="1d6 + 1">💥 1d6 + 1</span>'
    );
    expect(result).toContain('to hit, reach 5 ft., one target.');
    expect(result).toContain('bludgeoning damage.');
  });

  test('badges DC values', () => {
    const result = plainTextToBadgedHtml(
      'The target must succeed on a DC 13 Wisdom saving throw.'
    );
    expect(result).toContain(
      'bg-blue-600/10 text-blue-400 border border-blue-600/20 hover:bg-blue-600/20" title="DC 13">🔢 DC 13</span>'
    );
  });

  test('HTML-escapes plain text before badging', () => {
    const result = plainTextToBadgedHtml('Tom & Jerry <fight> "now"');
    expect(result).toContain('Tom &amp; Jerry &lt;fight&gt; &quot;now&quot;');
  });

  test('badges "Ranged Weapon Attack:" and "Melee or Ranged Weapon Attack:" labels', () => {
    expect(plainTextToBadgedHtml('Ranged Weapon Attack: +5 to hit')).toContain(
      'title="Ranged Weapon Attack:">⚔️ Ranged Weapon Attack:</span>'
    );
    expect(
      plainTextToBadgedHtml('Melee or Ranged Weapon Attack: +5 to hit')
    ).toContain(
      'title="Melee or Ranged Weapon Attack:">⚔️ Melee or Ranged Weapon Attack:</span>'
    );
  });

  test('badges bare "Melee Attack:" / "Ranged Attack:" labels', () => {
    expect(plainTextToBadgedHtml('Melee Attack: +4 to hit')).toContain(
      'title="Melee Attack:">⚔️ Melee Attack:</span>'
    );
  });

  test('does not double-badge inside already-inserted spans', () => {
    const result = plainTextToBadgedHtml(
      'Melee Weapon Attack: +3 to hit, 4 (1d6 + 1) bludgeoning damage. DC 13 save.'
    );
    // Only one span per distinct badge type/value expected, not nested/duplicated matches.
    const spanCount = (result.match(/<span /g) || []).length;
    expect(spanCount).toBe(4);
  });

  test('is collision-proof against user text containing the literal placeholder token', () => {
    const result = plainTextToBadgedHtml(
      'Weird <<SBT_BADGE_0>> text, +3 to hit'
    );
    // The literal token is HTML-escaped, so it can never collide with the
    // internal `<<SBT_BADGE_N>>` substitution sentinel (which is only ever
    // introduced after escaping).
    expect(result).toContain('&lt;&lt;SBT_BADGE_0&gt;&gt;');
    expect(result).toContain(
      'bg-emerald-600/10 text-emerald-400 border border-emerald-600/20 hover:bg-emerald-600/20" title="+3">🎯 +3</span>'
    );
    expect(result).not.toContain('undefined');
  });
});

describe('renderStatBlockEntryText', () => {
  test('returns legacy HTML input unchanged (short-circuit)', () => {
    expect(renderStatBlockEntryText(ZOMBIE_HTML)).toBe(ZOMBIE_HTML);
  });

  test('badges plain text input', () => {
    const result = renderStatBlockEntryText(ZOMBIE_PLAIN);
    expect(result).toContain('<span');
    expect(result).toContain('to hit');
  });

  test('is idempotent when applied to its own output', () => {
    const once = renderStatBlockEntryText(ZOMBIE_PLAIN);
    const twice = renderStatBlockEntryText(once);
    expect(twice).toBe(once);
  });
});

describe('parseAttackTokens', () => {
  test('extracts the first to-hit and damage dice tokens', () => {
    expect(parseAttackTokens(ZOMBIE_PLAIN)).toEqual({
      toHit: '+3',
      damage: '1d6 + 1',
    });
  });

  test('returns nulls for non-attack text', () => {
    expect(parseAttackTokens('The zombie shambles forward.')).toEqual({
      toHit: null,
      damage: null,
    });
  });

  test('extracts only the first match when multiple are present', () => {
    expect(
      parseAttackTokens(
        'Melee: +5 to hit, 2d8 + 2 damage. Or +7 to hit, 1d4 damage.'
      )
    ).toEqual({ toHit: '+5', damage: '2d8 + 2' });
  });
});

describe('replaceToHit', () => {
  test('replaces the first occurrence only and preserves surrounding text', () => {
    const text = 'Melee Weapon Attack: +3 to hit, reach 5 ft., one target.';
    expect(replaceToHit(text, '+7')).toBe(
      'Melee Weapon Attack: +7 to hit, reach 5 ft., one target.'
    );
  });

  test('leaves later "to hit" style occurrences elsewhere in the text untouched beyond the first', () => {
    const text = '+3 to hit here, and +3 to hit again';
    expect(replaceToHit(text, '+9')).toBe(
      '+9 to hit here, and +3 to hit again'
    );
  });

  test('returns text unchanged when there is no to-hit token', () => {
    const text = 'The zombie shambles forward.';
    expect(replaceToHit(text, '+7')).toBe(text);
  });
});

describe('replaceDamage', () => {
  test('replaces the first dice occurrence only and preserves surrounding text', () => {
    const text = '4 (1d6 + 1) bludgeoning damage.';
    expect(replaceDamage(text, '2d8 + 3')).toBe(
      '4 (2d8 + 3) bludgeoning damage.'
    );
  });

  test('leaves later dice occurrences untouched beyond the first', () => {
    const text = '1d6 + 1 now, 1d6 + 1 later';
    expect(replaceDamage(text, '3d10')).toBe('3d10 now, 1d6 + 1 later');
  });

  test('returns text unchanged when there is no dice token', () => {
    const text = 'The zombie shambles forward.';
    expect(replaceDamage(text, '2d8')).toBe(text);
  });
});
