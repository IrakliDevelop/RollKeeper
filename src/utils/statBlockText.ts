import type { IconName } from '@/components/ui/icons';
import {
  renderIconHtml,
  replaceLegacyBadgeIcon,
} from '@/components/ui/icons/iconHtml';

/**
 * Conversion utilities between plain stat block action text and the
 * badge-span HTML produced by `formatReferenceHtml` (see
 * `src/utils/referenceParser.ts`) for the atk/hit/dc/damage badge types.
 *
 * Bestiary action text is historically stored as pre-rendered badge-span
 * HTML. These utils let editors round-trip that HTML to plain text for
 * editing, then re-badge the edited plain text back to the same markup at
 * display time.
 *
 * Pure functions only — no React, no DOM APIs (regex-based so this can run
 * in a plain node/jsdom test environment without DOMParser).
 */

const BASE_BADGE_CLASSES =
  'inline-flex items-center gap-1 px-2 py-1 rounded text-sm font-medium transition-colors';

type BadgeType = 'atk' | 'hit' | 'dc' | 'damage';

const BADGE_STYLES: Record<BadgeType, { classes: string; icon: IconName }> = {
  atk: {
    classes:
      'bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/20',
    icon: 'attack',
  },
  hit: {
    classes:
      'bg-emerald-600/10 text-emerald-400 border border-emerald-600/20 hover:bg-emerald-600/20',
    icon: 'target',
  },
  dc: {
    classes:
      'bg-blue-600/10 text-blue-400 border border-blue-600/20 hover:bg-blue-600/20',
    icon: 'save',
  },
  damage: {
    classes:
      'bg-red-600/10 text-red-400 border border-red-600/20 hover:bg-red-600/20',
    icon: 'damage',
  },
};

function badgeSpan(type: BadgeType, displayText: string): string {
  const { classes, icon } = BADGE_STYLES[type];
  return `<span class="${BASE_BADGE_CLASSES} ${classes}" data-app-icon="${icon}" title="${displayText}">${renderIconHtml(icon)} ${displayText}</span>`;
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
 * Convert badge-span HTML (as produced by `formatReferenceHtml`) back to
 * plain text: badge spans become their plain value (the leading emoji icon
 * token is dropped), any remaining tags are stripped, basic HTML entities
 * are decoded, and whitespace is collapsed. Plain text input is returned
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
 * Convert plain stat block action text into the badge-span HTML produced by
 * `formatReferenceHtml` for the atk/hit/dc/damage reference types. Text is
 * HTML-escaped first, then badged in order: attack labels, to-hit modifiers,
 * DC values, and damage dice. Numbered placeholder tokens are used during
 * substitution so later passes never match text already inside a badge span.
 */
export function plainTextToBadgedHtml(text: string): string {
  const escaped = escapeHtml(text);
  const badges: string[] = [];

  const withPlaceholder = (input: string, type: BadgeType, regex: RegExp) =>
    input.replace(regex, matched => {
      const index = badges.length;
      badges.push(badgeSpan(type, matched));
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

function upgradeLegacyBadgeHtml(html: string): string {
  return html.replace(
    BADGE_SPAN_REGEX,
    (span, attributes: string, content: string) => {
      let icon: IconName | null = null;
      if (attributes.includes('bg-violet-')) icon = 'attack';
      else if (attributes.includes('bg-emerald-')) icon = 'target';
      else if (attributes.includes('bg-blue-')) icon = 'save';
      else if (attributes.includes('bg-red-')) icon = 'damage';
      if (!icon) return span;

      const upgradedAttributes = attributes.includes('data-app-icon=')
        ? attributes
        : `${attributes} data-app-icon="${icon}"`;
      return `<span${upgradedAttributes}>${replaceLegacyBadgeIcon(content, icon)}</span>`;
    }
  );
}

/**
 * Render a stat block entry's text for display. Legacy badge HTML is upgraded
 * to canonical SVG icons without mutating stored data; plain text is badged.
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
