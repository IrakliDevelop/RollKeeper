/**
 * Reads the colour tokens out of the text of `globals.css`, so the
 * Foundations pages list exactly the tokens the app defines. Only names and
 * notes come from here: values are read from the browser per theme.
 */

export interface ColourToken {
  /** The custom property, e.g. `--surface`. */
  name: string;
  /** The comment on the token's line in the paper block, if any. */
  note: string | null;
}

export interface ColourRole {
  /** e.g. `brass`. */
  role: string;
  /** The comment on the role's `-text` line: what the colour means. */
  job: string | null;
  /** `--{role}-text`, `-fill`, `-border`, `-bg`, then `--on-{role}`. */
  tokens: string[];
}

export interface ColourAlias {
  /** e.g. `--ring`. */
  name: string;
  /** The token it points at, e.g. `--brass-fill`. */
  target: string;
}

export interface ThemeColours {
  neutrals: ColourToken[];
  roles: ColourRole[];
  aliases: ColourAlias[];
}

// The paper block holds every literal; felt only overrides values.
const PAPER_BLOCK =
  /(?:^|\}|\*\/)\s*:root,\s*\[data-theme='light'\]\s*\{([^}]*)\}/;
// The first shared block holds the tokens defined in terms of others.
const SHARED_BLOCK = /(?:^|\}|\*\/)\s*:root,\s*\[data-theme\]\s*\{([^}]*)\}/;
// A declaration, and a comment that ends its line.
const DECLARATION =
  /(--[\w-]+)\s*:\s*([^;]+);[ \t]*(?:\/\*\s*([\s\S]*?)\s*\*\/)?/g;
const ALIAS = /^var\((--[\w-]+)\)$/;

// The one shadow token sits among the neutrals; the Shape and elevation
// page shows it. Every other neutral is a colour, whatever its notation.
function isShadow(name: string) {
  return name.endsWith('-shadow');
}

function block(css: string, pattern: RegExp, label: string) {
  const match = css.match(pattern);
  if (!match) throw new Error(`No ${label} block in globals.css`);
  return match[1];
}

function declarations(text: string) {
  return Array.from(text.matchAll(DECLARATION), match => ({
    name: match[1],
    value: match[2].trim(),
    note: match[3] ?? null,
    index: match.index ?? 0,
  }));
}

export function readThemeColours(css: string): ThemeColours {
  const paper = block(css, PAPER_BLOCK, "paper (:root, [data-theme='light'])");
  const neutralsAt = paper.indexOf('--- Neutrals');
  const rolesAt = paper.indexOf('--- Roles');
  const bridgeAt = paper.indexOf('--- Deprecated');
  if (neutralsAt < 0 || rolesAt < 0 || bridgeAt < 0) {
    throw new Error('globals.css paper block lost a section heading');
  }
  const all = declarations(paper);

  const neutrals = all
    .filter(d => d.index > neutralsAt && d.index < rolesAt)
    .filter(d => !isShadow(d.name))
    .map(({ name, note }) => ({ name, note }));

  const roleDeclarations = all.filter(
    d => d.index > rolesAt && d.index < bridgeAt
  );
  const roles = roleDeclarations
    .filter(d => d.name.endsWith('-text'))
    .map(text => {
      const role = text.name.slice(2, -'-text'.length);
      const tokens = roleDeclarations
        .map(d => d.name)
        .filter(n => n.startsWith(`--${role}-`) || n === `--on-${role}`);
      return { role, job: text.note, tokens };
    });

  const aliases = declarations(block(css, SHARED_BLOCK, 'shared'))
    .map(d => ({ name: d.name, target: d.value.match(ALIAS)?.[1] }))
    .filter((d): d is ColourAlias => d.target !== undefined);

  return { neutrals, roles, aliases };
}
