/**
 * Conversion utilities between plain stat block action text and the
 * typographic HTML produced by `formatReferenceHtml` (see
 * `src/utils/referenceParser.ts`) for attack/hit/DC/damage types.
 *
 * Bestiary action text is historically stored as pre-rendered badge-span
 * HTML. These utils let editors round-trip that HTML to plain text for
 * editing, then format the edited plain text back to readable markup at
 * display time.
 *
 * Pure functions only — no React, no DOM APIs (regex-based so this can run
 * in a plain node/jsdom test environment without DOMParser).
 */

type BadgeType = 'atk' | 'hit' | 'dc' | 'damage';

function formatInlineStat(type: BadgeType, displayText: string): string {
  return type === 'atk'
    ? `<strong><em>${displayText}</em></strong>`
    : `<strong>${displayText}</strong>`;
}

const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

function decodeBasicEntities(text: string): string {
  return text.replace(
    /&amp;|&lt;|&gt;|&quot;|&#39;/g,
    match => HTML_ENTITIES[match]
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

const SPAN_REGEX = /<span\b[^>]*>([\s\S]*?)<\/span>/gi;

/**
 * Convert formatted or legacy badge HTML back to plain text. Legacy leading
 * emoji/SVG icons are dropped, remaining tags are stripped, basic HTML
 * entities are decoded, and whitespace is collapsed. Plain text is returned
 * unchanged (aside from whitespace/entity normalization, which are no-ops
 * on already-plain text).
 */
export function statBlockHtmlToPlainText(html: string): string {
  if (!html) {
    return html;
  }

  const withSpansUnwrapped = html.replace(
    SPAN_REGEX,
    (_match, inner: string) => {
      const trimmed = inner.replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, '').trim();
      const firstSpaceIndex = trimmed.indexOf(' ');

      if (firstSpaceIndex === -1) {
        return trimmed;
      }

      const firstToken = trimmed.slice(0, firstSpaceIndex);
      const rest = trimmed.slice(firstSpaceIndex + 1);

      // Only drop the first token if it looks like an emoji/icon. Badge types
      // with no icon (unknown types) must not lose their first real word.
      if (/\p{Extended_Pictographic}/u.test(firstToken)) {
        return rest;
      }

      return trimmed;
    }
  );

  const withoutTags = withSpansUnwrapped.replace(/<[^>]*>/g, '');
  const decoded = decodeBasicEntities(withoutTags);
  return collapseWhitespace(decoded);
}

// Order matters: attack labels first (longest/most specific alternatives
// first), then to-hit, then DC, then damage dice. Placeholder tokens are
// used between passes so later regexes never match text inside an
// already-inserted badge span.
const ATTACK_LABEL_REGEX =
  /(Melee or Ranged (?:Weapon|Spell) Attack:|(?:Melee|Ranged) (?:Weapon|Spell) Attack:|(?:Melee|Ranged) Attack:)/g;
const TO_HIT_REGEX = /([+-]\d+)(?= to hit)/g;
const DC_REGEX = /(DC \d+)/g;
const DICE_REGEX = /(\d+d\d+(?:\s*[+-]\s*\d+)?)/g;

const PLACEHOLDER_PREFIX = '<<SBT_BADGE_';
const PLACEHOLDER_SUFFIX = '>>';

/**
 * Convert plain stat block action text into restrained typographic HTML.
 * Text is HTML-escaped first, then formatted in order: attack labels, to-hit modifiers,
 * DC values, and damage dice. Numbered placeholder tokens are used during
 * substitution so later passes never match text already inside a badge span.
 */
export function plainTextToBadgedHtml(text: string): string {
  const escaped = escapeHtml(text);
  const badges: string[] = [];

  const withPlaceholder = (input: string, type: BadgeType, regex: RegExp) =>
    input.replace(regex, matched => {
      const index = badges.length;
      badges.push(formatInlineStat(type, matched));
      return `${PLACEHOLDER_PREFIX}${index}${PLACEHOLDER_SUFFIX}`;
    });

  let result = escaped;
  result = withPlaceholder(result, 'atk', ATTACK_LABEL_REGEX);
  result = withPlaceholder(result, 'hit', TO_HIT_REGEX);
  result = withPlaceholder(result, 'dc', DC_REGEX);
  result = withPlaceholder(result, 'damage', DICE_REGEX);

  const placeholderRegex = new RegExp(
    `${PLACEHOLDER_PREFIX}(\\d+)${PLACEHOLDER_SUFFIX}`,
    'g'
  );

  return result.replace(
    placeholderRegex,
    (_match, index: string) => badges[Number(index)]
  );
}

const HTML_TAG_REGEX = /<[a-z][^>]*>/i;
const BADGE_SPAN_REGEX = /<span\b([^>]*)>([\s\S]*?)<\/span>/gi;
const LEGACY_ICON_PATTERN =
  /^(?:⚔️?|✨|🔍|🎲|🐉|💫|⚡|🎯|👁️?|💥|📈|🏹|🔢|🛡️?|❌|✅|↩️|❓)\s*/u;

function upgradeLegacyBadgeHtml(html: string): string {
  return html.replace(
    BADGE_SPAN_REGEX,
    (span, attributes: string, content: string) => {
      let type: BadgeType | null = null;
      if (
        attributes.includes('data-app-icon="attack"') ||
        attributes.includes('bg-violet-')
      )
        type = 'atk';
      else if (
        attributes.includes('data-app-icon="target"') ||
        attributes.includes('bg-emerald-')
      )
        type = 'hit';
      else if (
        attributes.includes('data-app-icon="save"') ||
        attributes.includes('bg-blue-')
      )
        type = 'dc';
      else if (
        attributes.includes('data-app-icon="damage"') ||
        attributes.includes('bg-red-')
      )
        type = 'damage';
      if (!type) return span;

      const text = content
        .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, '')
        .replace(LEGACY_ICON_PATTERN, '')
        .trim();
      return formatInlineStat(type, text);
    }
  );
}

/**
 * Render a stat block entry with restrained typography. Legacy badge HTML is
 * normalized without mutating stored data; plain text is formatted directly.
 */
export function renderStatBlockEntryText(text: string): string {
  if (HTML_TAG_REGEX.test(text)) {
    return upgradeLegacyBadgeHtml(text);
  }

  return plainTextToBadgedHtml(text);
}

const TO_HIT_TOKEN_REGEX = /([+-]\d+) to hit/;
const DICE_TOKEN_REGEX = /\d+d\d+(?:\s*[+-]\s*\d+)?/;

/**
 * Parse the first to-hit modifier and first damage dice expression out of a
 * stat block entry's plain text.
 */
export function parseAttackTokens(text: string): {
  toHit: string | null;
  damage: string | null;
} {
  const toHitMatch = text.match(TO_HIT_TOKEN_REGEX);
  const damageMatch = text.match(DICE_TOKEN_REGEX);

  return {
    toHit: toHitMatch ? toHitMatch[1] : null,
    damage: damageMatch ? damageMatch[0] : null,
  };
}

/**
 * Replace the first `+N to hit` / `-N to hit` modifier in `text` with
 * `value`, leaving everything else untouched. No-op if there is no match.
 */
export function replaceToHit(text: string, value: string): string {
  return text.replace(TO_HIT_TOKEN_REGEX, `${value} to hit`);
}

/**
 * Replace the first dice expression (`NdM` optionally followed by `+/-K`) in
 * `text` with `dice`, leaving everything else untouched. No-op if there is
 * no match.
 */
export function replaceDamage(text: string, dice: string): string {
  return text.replace(DICE_TOKEN_REGEX, dice);
}
