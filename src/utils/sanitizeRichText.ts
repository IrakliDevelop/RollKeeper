/**
 * Allow-list sanitiser for rich text written in RichTextEditor and
 * CompactRichTextEditor. That HTML is stored and crosses users (DM messages,
 * NPC lore, item descriptions), so it is rebuilt before it reaches
 * `dangerouslySetInnerHTML`.
 *
 * It is a plain string tokenizer, not a DOM parser, so it runs the same on the
 * server render and in the browser. Safety does not rest on matching the
 * browser's parser exactly: the output is rebuilt from scratch, holding only
 * allow-listed tags with validated, double-quoted, escaped attributes and text
 * with every `<` and `>` escaped. A parse that differs from the browser's can
 * drop content, never let markup through.
 *
 * Allowed: what StarterKit, TableKit and TextStyle/Color emit, plus the markup
 * the app's own 5etools converters put into item and feature text that can be
 * saved without passing through an editor: `caption`, `thead`, a bare `div`,
 * and `referenceParser`'s reference span (its one fixed class and `title`).
 * Everything else loses its tag and keeps its text, except elements whose
 * content is code or foreign markup, which are dropped whole.
 */

type AttrRule = (value: string) => string | null;

const matching =
  (pattern: RegExp): AttrRule =>
  value =>
    pattern.test(value) ? value : null;

const cellAttrs: Record<string, AttrRule> = {
  colspan: matching(/^\d{1,4}$/),
  rowspan: matching(/^\d{1,4}$/),
  // TipTap joins one width per spanned column: "120,120".
  colwidth: matching(/^\d{1,5}(?:,\d{1,5})*$/),
};

const ALLOWED_TAGS: Record<string, Record<string, AttrRule>> = {
  p: {},
  br: {},
  strong: {},
  em: {},
  u: {},
  s: {},
  code: { class: matching(/^language-[\w+#.-]{1,40}$/) },
  pre: {},
  blockquote: {},
  hr: {},
  h1: {},
  h2: {},
  h3: {},
  h4: {},
  h5: {},
  h6: {},
  ul: {},
  ol: { start: matching(/^-?\d{1,9}$/), type: matching(/^[1aAiI]$/) },
  li: {},
  a: {
    href: safeHref,
    target: value => (value === '_blank' ? value : null),
    rel: linkRel,
  },
  span: {
    style: value => filterStyle(value, COLOR_STYLE),
    class: value => (value === REFERENCE_CLASS ? value : null),
    title: value => value,
  },
  div: {},
  table: { style: value => filterStyle(value, SIZE_STYLE) },
  colgroup: {},
  col: { style: value => filterStyle(value, SIZE_STYLE) },
  caption: {},
  thead: {},
  tbody: {},
  tfoot: {},
  tr: {},
  th: cellAttrs,
  td: cellAttrs,
};

/** `referenceParser`'s class for spell, item and rule references. */
const REFERENCE_CLASS =
  'font-medium underline decoration-dotted underline-offset-2';

const VOID_TAGS = new Set(['br', 'hr', 'col']);

/** The browser reads these as raw text up to their end tag: drop it all. */
const RAW_TEXT_TAGS = new Set([
  'script',
  'style',
  'textarea',
  'title',
  'xmp',
  'iframe',
  'noembed',
  'noframes',
  'noscript',
]);

/** Foreign or inert subtrees: drop the element and everything inside. */
const DROPPED_SUBTREE_TAGS = new Set([
  'svg',
  'math',
  'template',
  'object',
  'applet',
  'select',
]);

const COLOR_VALUE =
  /^(?:#[\da-f]{3,8}|[a-z]{3,30}|(?:rgba?|hsla?)\((?:[\d\s.,%/]|deg|turn)*\)|var\(--[\w-]{1,60}\))$/i;
const SIZE_VALUE = /^\d{1,5}(?:\.\d{1,3})?px$/;
const COLOR_STYLE: Record<string, RegExp> = { color: COLOR_VALUE };
const SIZE_STYLE: Record<string, RegExp> = {
  width: SIZE_VALUE,
  'min-width': SIZE_VALUE,
};

const LINK_REL_TOKENS = new Set(['noopener', 'noreferrer', 'nofollow', 'ugc']);
const SAFE_SCHEMES = new Set(['http', 'https', 'mailto']);

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  colon: ':',
  tab: '\t',
  newline: '\n',
  sol: '/',
  lpar: '(',
  rpar: ')',
  period: '.',
};

const WHITESPACE = /[\t\n\f\r ]/;
const ASCII_LETTER = /[a-z]/i;

/** Own-property lookup, so names like `constructor` find nothing. */
function own<T>(record: Record<string, T>, key: string): T | undefined {
  return Object.hasOwn(record, key) ? record[key] : undefined;
}

function asciiLower(value: string): string {
  return value.replace(/[A-Z]/g, c => c.toLowerCase());
}

function filterStyle(
  value: string,
  rules: Record<string, RegExp>
): string | null {
  const kept: string[] = [];
  const seen = new Set<string>();
  for (const declaration of value.split(';')) {
    const colon = declaration.indexOf(':');
    if (colon === -1) continue;
    const property = asciiLower(declaration.slice(0, colon).trim());
    const propertyValue = declaration.slice(colon + 1).trim();
    if (seen.has(property) || !own(rules, property)?.test(propertyValue)) {
      continue;
    }
    seen.add(property);
    kept.push(`${property}: ${propertyValue};`);
  }
  return kept.length > 0 ? kept.join(' ') : null;
}

function linkRel(value: string): string | null {
  const tokens = value
    .split(/[\t\n\f\r ]+/)
    .filter(token => LINK_REL_TOKENS.has(asciiLower(token)));
  return tokens.length > 0 ? tokens.join(' ') : null;
}

/**
 * `value` is already entity-decoded, so it is exactly the URL the browser
 * will see once the output is escaped again.
 */
function safeHref(value: string): string | null {
  // What the URL parser does first: trim C0 controls and spaces, then
  // remove every tab and newline.
  const url = value
    .replace(/^[\u0000- ]+|[\u0000- ]+$/g, '')
    .replace(/[\t\n\r]/g, '');
  if (/[\u0000-\u001f\u007f]/.test(url)) return null;
  const scheme = /^([a-z][a-z\d+.-]*):/i.exec(url);
  if (scheme && !SAFE_SCHEMES.has(asciiLower(scheme[1]))) return null;
  return url;
}

function decodeEntities(value: string): string {
  return value.replace(
    /&(?:#(\d{1,7})|#x([\da-f]{1,6})|([a-z][a-z\d]{1,31}));?/gi,
    (match, decimal?: string, hex?: string, name?: string) => {
      if (name !== undefined) {
        // Named references only decode with their semicolon here; anything
        // left encoded is escaped below and shows as literal text.
        if (!match.endsWith(';')) return match;
        return own(NAMED_ENTITIES, asciiLower(name)) ?? match;
      }
      const code =
        decimal !== undefined ? parseInt(decimal, 10) : parseInt(hex!, 16);
      return code > 0 && code <= 0x10ffff && (code < 0xd800 || code > 0xdfff)
        ? String.fromCodePoint(code)
        : '�';
    }
  );
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeText(value: string): string {
  return value
    .replace(/&(?!(?:#\d{1,7}|#x[\da-f]{1,6}|[a-z][a-z\d]{0,31});)/gi, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

interface Tag {
  name: string;
  closing: boolean;
  selfClosing: boolean;
  attrs: Array<[string, string]>;
  /** Index just past the tag's `>`. */
  end: number;
}

/**
 * Reads a start or end tag at `start` (the `<`), following the HTML
 * tokenizer's tag and attribute states. Returns null when the input ends
 * inside the tag, which the browser also drops.
 */
function readTag(html: string, start: number, closing: boolean): Tag | null {
  const n = html.length;
  let pos = start + (closing ? 2 : 1);
  const nameStart = pos;
  while (
    pos < n &&
    !WHITESPACE.test(html[pos]) &&
    html[pos] !== '/' &&
    html[pos] !== '>'
  ) {
    pos++;
  }
  const name = asciiLower(html.slice(nameStart, pos));
  const attrs: Array<[string, string]> = [];
  let selfClosing = false;

  while (pos < n) {
    const ch = html[pos];
    if (WHITESPACE.test(ch)) {
      pos++;
      continue;
    }
    if (ch === '/') {
      selfClosing = html[pos + 1] === '>';
      pos++;
      continue;
    }
    if (ch === '>') {
      return { name, closing, selfClosing, attrs, end: pos + 1 };
    }
    selfClosing = false;
    // An `=` at the start of a name belongs to the name.
    const attrStart = pos;
    pos++;
    while (
      pos < n &&
      !WHITESPACE.test(html[pos]) &&
      !'/>='.includes(html[pos])
    ) {
      pos++;
    }
    const attrName = asciiLower(html.slice(attrStart, pos));
    while (pos < n && WHITESPACE.test(html[pos])) pos++;
    let value = '';
    if (html[pos] === '=') {
      pos++;
      while (pos < n && WHITESPACE.test(html[pos])) pos++;
      const quote = html[pos];
      if (quote === '"' || quote === "'") {
        const close = html.indexOf(quote, pos + 1);
        if (close === -1) return null;
        value = html.slice(pos + 1, close);
        pos = close + 1;
      } else {
        const valueStart = pos;
        while (pos < n && !WHITESPACE.test(html[pos]) && html[pos] !== '>')
          pos++;
        value = html.slice(valueStart, pos);
      }
    }
    attrs.push([attrName, value]);
  }
  return null;
}

/** Index just past the end tag that closes a raw-text element, or the end. */
function skipRawText(html: string, from: number, name: string): number {
  const closer = new RegExp(`</${name}(?=[\\t\\n\\f\\r />])`, 'ig');
  closer.lastIndex = from;
  const match = closer.exec(html);
  if (!match) return html.length;
  const tag = readTag(html, match.index, true);
  return tag ? tag.end : html.length;
}

/** Index just past the comment or other markup declaration at `start`. */
function skipDeclaration(html: string, start: number): number {
  if (html.startsWith('<!--', start)) {
    if (html.startsWith('<!-->', start)) return start + 5;
    if (html.startsWith('<!--->', start)) return start + 6;
    const close = /--!?>/g;
    close.lastIndex = start + 4;
    const match = close.exec(html);
    return match ? match.index + match[0].length : html.length;
  }
  const close = html.indexOf('>', start);
  return close === -1 ? html.length : close + 1;
}

function serializeStartTag(tag: Tag): string {
  const rules = own(ALLOWED_TAGS, tag.name) ?? {};
  const seen = new Set<string>();
  let out = `<${tag.name}`;
  for (const [name, raw] of tag.attrs) {
    // The browser keeps the first of duplicate attributes.
    if (seen.has(name)) continue;
    seen.add(name);
    const rule = own(rules, name);
    if (!rule) continue;
    const value = rule(decodeEntities(raw));
    if (value !== null) out += ` ${name}="${escapeAttr(value)}"`;
  }
  return `${out}>`;
}

export function sanitizeRichText(html: string): string {
  const n = html.length;
  let out = '';
  let pos = 0;
  // While inside a dropped subtree: its tag name and nesting depth.
  let dropping: string | null = null;
  let depth = 0;

  while (pos < n) {
    const lt = html.indexOf('<', pos);
    const textEnd = lt === -1 ? n : lt;
    if (textEnd > pos && dropping === null) {
      out += escapeText(html.slice(pos, textEnd));
    }
    if (lt === -1) break;
    pos = lt;

    const next = html[pos + 1];
    if (next === '!' || next === '?') {
      pos = skipDeclaration(html, pos);
      continue;
    }
    if (next === '/') {
      const after = html[pos + 2];
      if (after === '>') {
        pos += 3;
        continue;
      }
      if (after === undefined || !ASCII_LETTER.test(after)) {
        pos = skipDeclaration(html, pos);
        continue;
      }
    } else if (next === undefined || !ASCII_LETTER.test(next)) {
      if (dropping === null) out += '&lt;';
      pos++;
      continue;
    }

    const tag = readTag(html, pos, next === '/');
    if (!tag) break;
    pos = tag.end;

    if (!tag.closing && tag.name === 'plaintext') break;
    if (!tag.closing && RAW_TEXT_TAGS.has(tag.name)) {
      pos = skipRawText(html, pos, tag.name);
      continue;
    }
    if (dropping !== null) {
      if (tag.name === dropping) {
        if (tag.closing) depth--;
        else if (!tag.selfClosing) depth++;
        if (depth === 0) dropping = null;
      }
      continue;
    }
    if (!tag.closing && DROPPED_SUBTREE_TAGS.has(tag.name)) {
      // `<svg/>` and `<math/>` close themselves; the others ignore the slash.
      if (!(tag.selfClosing && (tag.name === 'svg' || tag.name === 'math'))) {
        dropping = tag.name;
        depth = 1;
      }
      continue;
    }
    if (!own(ALLOWED_TAGS, tag.name)) continue;
    if (tag.closing) {
      if (!VOID_TAGS.has(tag.name)) out += `</${tag.name}>`;
    } else {
      out += serializeStartTag(tag);
    }
  }
  return out;
}
