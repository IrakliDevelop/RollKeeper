export interface ParsedReference {
  type:
    | 'item'
    | 'spell'
    | 'filter'
    | 'dice'
    | 'creature'
    | 'condition'
    | 'action'
    | 'skill'
    | 'sense'
    | 'damage'
    | 'scaledamage'
    | 'atk'
    | 'atkr'
    | 'hit'
    | 'h'
    | 'dc'
    | 'actSave'
    | 'actSaveFail'
    | 'actSaveSuccess'
    | 'actTrigger'
    | 'actResponse'
    | 'hitYourSpellAttack'
    | 'unknown';
  name: string;
  source?: string;
  displayText: string;
  properties?: Record<string, string>;
  isReference: boolean;
}

export interface ParsedContent {
  text: string;
  references: ParsedReference[];
  html: string;
}

/**
 * Parse 5etools-style references from text content
 * Formats: {@type name|source|extra}, {@type name|source}, {@type name}
 */
export function parseReferences(content: string): ParsedContent {
  if (!content) {
    return { text: content, references: [], html: content };
  }

  const references: ParsedReference[] = [];
  let parsedHtml = content;

  // Regex to match {@type content} patterns
  const referenceRegex = /\{@(\w+)\s+([^}]+)\}/g;

  let match;
  while ((match = referenceRegex.exec(content)) !== null) {
    const [fullMatch, type, content] = match;
    const parts = content.split('|');

    const name = parts[0]?.trim() || '';
    const source = parts[1]?.trim();
    const extra = parts.slice(2);

    const reference: ParsedReference = {
      type: normalizeReferenceType(type),
      name,
      source,
      displayText: formatDisplayText(type, name, source, extra),
      properties: parseExtraProperties(extra),
      isReference: true,
    };

    references.push(reference);

    // Replace in HTML with styled version
    parsedHtml = parsedHtml.replace(fullMatch, formatReferenceHtml(reference));
  }

  // Clean up any remaining malformed references
  parsedHtml = parsedHtml.replace(/\{@\w+[^}]*\}/g, match => {
    // If we couldn't parse it properly, just remove the {@...} wrapper
    return match.replace(/\{@\w+\s*/, '').replace(/\}$/, '');
  });

  return {
    text: content,
    references,
    html: parsedHtml,
  };
}

/**
 * Normalize reference types to known categories
 */
function normalizeReferenceType(type: string): ParsedReference['type'] {
  const typeMap: Record<string, ParsedReference['type']> = {
    item: 'item',
    spell: 'spell',
    filter: 'filter',
    dice: 'dice',
    creature: 'creature',
    condition: 'condition',
    action: 'action',
    skill: 'skill',
    sense: 'sense',
    damage: 'damage',
    scaledamage: 'scaledamage',
    atk: 'atk',
    atkr: 'atkr',
    hit: 'hit',
    h: 'h',
    dc: 'dc',
    actsave: 'actSave',
    actsavefail: 'actSaveFail',
    actsavesuccess: 'actSaveSuccess',
    acttrigger: 'actTrigger',
    actresponse: 'actResponse',
    hityourspellattack: 'hitYourSpellAttack',
    // Add more mappings as needed
  };

  return typeMap[type.toLowerCase()] || 'unknown';
}

/**
 * Parse scaled damage format: {@scaledamage baseDamage|levelRange|additionalPerLevel}
 * Example: {@scaledamage 8d6|3-9|1d6} -> "8d6 (+ 1d6 per level above 3rd)"
 */
function parseScaledDamage(
  baseDamage: string,
  levelRange?: string,
  extra?: string[]
): string {
  if (!levelRange || !extra || extra.length === 0) {
    return baseDamage; // Fallback to base damage if parsing fails
  }

  const additionalPerLevel = extra[0];
  const levelParts = levelRange.split('-');
  const startLevel = levelParts[0];

  if (!startLevel || !additionalPerLevel) {
    return baseDamage;
  }

  // Format the level suffix (1st, 2nd, 3rd, 4th, etc.)
  const levelSuffix = getLevelSuffix(parseInt(startLevel));

  return `${baseDamage} (+ ${additionalPerLevel} per level above ${levelSuffix})`;
}

/**
 * Get the ordinal suffix for a level number
 */
function getLevelSuffix(level: number): string {
  if (level >= 11 && level <= 13) {
    return `${level}th`;
  }

  const lastDigit = level % 10;
  switch (lastDigit) {
    case 1:
      return `${level}st`;
    case 2:
      return `${level}nd`;
    case 3:
      return `${level}rd`;
    default:
      return `${level}th`;
  }
}

/**
 * Format display text based on reference type and content
 */
function formatDisplayText(
  type: string,
  name: string,
  source?: string,
  extra?: string[]
): string {
  switch (type.toLowerCase()) {
    case 'item':
      return name;

    case 'filter':
      return name;

    case 'spell':
      return name;

    case 'dice':
      return name;

    case 'creature':
      return name;

    case 'condition':
      return name;

    case 'action':
      return name;

    case 'skill':
      return name;

    case 'sense':
      return name;

    case 'damage':
      return name;

    case 'scaledamage':
      return parseScaledDamage(name, source, extra);

    case 'atk':
      // Handle attack types like "mw" (melee weapon), "rw" (ranged weapon)
      switch (name.toLowerCase()) {
        case 'm':
        case 'mw':
          return 'Melee Weapon Attack:';
        case 'r':
        case 'rw':
          return 'Ranged Weapon Attack:';
        case 'ms':
          return 'Melee Spell Attack:';
        case 'rs':
          return 'Ranged Spell Attack:';
        default:
          return `${name} Attack:`;
      }

    case 'atkr':
      // Handle ranged attack types
      switch (name.toLowerCase()) {
        case 'm':
          return 'Melee Attack:';
        case 'r':
          return 'Ranged Attack:';
        default:
          return `${name} Attack:`;
      }

    case 'hit':
      return `+${name}`;

    case 'h':
      return `Hit: ${name}`;

    case 'dc':
      return `DC ${name}`;

    case 'actsave':
      return `${name.toUpperCase()} save`;

    case 'actsavefail':
      return 'On a failed save:';

    case 'actsavesuccess':
      return 'On a successful save:';

    case 'acttrigger':
      return `Trigger: ${name}`;

    case 'actresponse':
      return `Response: ${name}`;

    case 'hityourspellattack':
      return name; // This typically contains the full text like "Bonus equals your spell attack modifier"

    default:
      return name;
  }
}

/**
 * Parse extra properties from reference parts
 */
function parseExtraProperties(extra: string[]): Record<string, string> {
  const properties: Record<string, string> = {};

  extra.forEach((prop, index) => {
    if (prop.includes('=')) {
      const [key, value] = prop.split('=', 2);
      properties[key.trim()] = value.trim();
    } else {
      properties[`extra_${index}`] = prop.trim();
    }
  });

  return properties;
}

/** Format dense rules references with restrained semantic typography. */
function formatReferenceHtml(reference: ParsedReference): string {
  switch (reference.type) {
    case 'atk':
    case 'atkr':
    case 'h':
    case 'actSave':
    case 'actSaveFail':
    case 'actSaveSuccess':
    case 'actTrigger':
    case 'actResponse':
      return `<strong><em>${reference.displayText}</em></strong>`;

    case 'dice':
    case 'damage':
    case 'scaledamage':
    case 'hit':
    case 'dc':
    case 'hitYourSpellAttack':
      return `<strong>${reference.displayText}</strong>`;

    case 'item':
    case 'spell':
      return `<em>${reference.displayText}</em>`;
  }

  const title = reference.source
    ? `${reference.displayText} (${reference.source})`
    : reference.displayText;
  return `<span class="font-medium underline decoration-dotted underline-offset-2" title="${title}">${reference.displayText}</span>`;
}

/**
 * Extract plain text from parsed content (removes all reference formatting)
 */
export function getPlainText(content: string): string {
  return parseReferences(content).html.replace(/<[^>]*>/g, '');
}

/**
 * Get all references from content
 */
export function extractReferences(content: string): ParsedReference[] {
  return parseReferences(content).references;
}

/**
 * Check if content contains references
 */
export function hasReferences(content: string): boolean {
  return /\{@\w+\s+[^}]+\}/.test(content);
}

/**
 * Get formatted HTML for React components
 */
export function getFormattedHtml(content: string): string {
  return parseReferences(content).html;
}

/**
 * Format reference as bold HTML for WYSIWYG editor
 * Used in spell edit modal to make important references stand out
 */
function formatReferenceForEditor(reference: ParsedReference): string {
  // For most references, just bold the display text
  return `<strong>${reference.displayText}</strong>`;
}

/**
 * Parse references and format them for WYSIWYG editor
 * Converts {@...} tags to bold text for better editing experience
 */
export function formatSpellDescriptionForEditor(content: string): string {
  if (!content) {
    return '';
  }

  let formattedHtml = content;

  // Regex to match {@type content} patterns
  const referenceRegex = /\{@(\w+)\s+([^}]+)\}/g;

  let match;
  const replacements: Array<{ from: string; to: string }> = [];

  while ((match = referenceRegex.exec(content)) !== null) {
    const [fullMatch, type, content] = match;
    const parts = content.split('|');

    const name = parts[0]?.trim() || '';
    const source = parts[1]?.trim();
    const extra = parts.slice(2);

    const reference: ParsedReference = {
      type: normalizeReferenceType(type),
      name,
      source,
      displayText: formatDisplayText(type, name, source, extra),
      properties: parseExtraProperties(extra),
      isReference: true,
    };

    // Replace with bold HTML for editor
    replacements.push({
      from: fullMatch,
      to: formatReferenceForEditor(reference),
    });
  }

  // Apply all replacements
  replacements.forEach(({ from, to }) => {
    formattedHtml = formattedHtml.replace(from, to);
  });

  // Clean up any remaining malformed references
  formattedHtml = formattedHtml.replace(/\{@\w+[^}]*\}/g, match => {
    // If we couldn't parse it properly, just remove the {@...} wrapper
    return match.replace(/\{@\w+\s*/, '').replace(/\}$/, '');
  });

  // Convert newlines to proper paragraph breaks for the editor
  // Split by double newlines (paragraph breaks)
  const paragraphs = formattedHtml.split('\n\n');

  // Wrap each paragraph in <p> tags if not already wrapped
  const wrappedParagraphs = paragraphs
    .map(para => {
      const trimmed = para.trim();
      if (!trimmed) return '';
      // If it already starts with an HTML tag, leave it as is
      if (trimmed.startsWith('<')) return trimmed;
      // Otherwise wrap in <p> tags
      return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`;
    })
    .filter(Boolean);

  return wrappedParagraphs.join('');
}
