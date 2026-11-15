import { afterEach, describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Underline from '@tiptap/extension-underline';
import { TableKit } from '@tiptap/extension-table';
import { sanitizeRichText } from './sanitizeRichText';
import {
  COMPACT_FIXTURE_HTML,
  EDITOR_FIXTURE_HTML,
  HOSTILE_CASES,
  UNCHANGED_INPUTS,
} from './sanitizeRichText.fixtures';

const editors: Editor[] = [];

afterEach(() => {
  editors.splice(0).forEach(editor => editor.destroy());
});

function fullEditor(content: string) {
  // Same extensions as RichTextEditor.
  const editor = new Editor({
    extensions: [
      StarterKit,
      TextStyle,
      Color,
      Underline,
      TableKit.configure({ table: { resizable: true } }),
    ],
    content,
  });
  editors.push(editor);
  return editor;
}

function compactEditor(content: string) {
  // Same extensions as CompactRichTextEditor.
  const editor = new Editor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        underline: false,
      }),
      Underline,
    ],
    content,
  });
  editors.push(editor);
  return editor;
}

function parse(html: string) {
  const template = document.createElement('template');
  template.innerHTML = html;
  return template.content;
}

describe('sanitizeRichText round trip', () => {
  it('the full-editor fixture is what RichTextEditor emits', () => {
    expect(fullEditor(EDITOR_FIXTURE_HTML).getHTML()).toBe(EDITOR_FIXTURE_HTML);
  });

  it('the compact fixture is what CompactRichTextEditor emits', () => {
    expect(compactEditor(COMPACT_FIXTURE_HTML).getHTML()).toBe(
      COMPACT_FIXTURE_HTML
    );
  });

  it('keeps editor output DOM-equivalent', () => {
    const html = fullEditor(EDITOR_FIXTURE_HTML).getHTML();
    const clean = sanitizeRichText(html);
    expect(parse(clean).isEqualNode(parse(html))).toBe(true);
    expect(clean).toBe(html);
  });

  it('keeps a table built and merged through editor commands', () => {
    const editor = fullEditor('<p></p>');
    editor.commands.insertTable({ rows: 3, cols: 3, withHeaderRow: true });
    editor.commands.insertContent('Header');
    // Select the first two header cells and merge them.
    const cells: number[] = [];
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'tableHeader') cells.push(pos);
    });
    editor.commands.setCellSelection({
      anchorCell: cells[0],
      headCell: cells[1],
    });
    expect(editor.commands.mergeCells()).toBe(true);
    const html = editor.getHTML();
    expect(html).toContain('colspan="2"');
    expect(sanitizeRichText(html)).toBe(html);
  });

  it.each(UNCHANGED_INPUTS.map(input => [input]))(
    'passes %j through unchanged',
    input => {
      expect(sanitizeRichText(input)).toBe(input);
    }
  );
});

describe('sanitizeRichText hostile input', () => {
  it.each(HOSTILE_CASES.map(c => [c.name, c]))('%s', (_name, c) => {
    expect(sanitizeRichText(c.input)).toBe(c.expected);
  });

  it('leaves nothing active in the rendered DOM', () => {
    const root = parse(
      HOSTILE_CASES.map(c => sanitizeRichText(c.input)).join('')
    );
    for (const tag of [
      'script',
      'style',
      'img',
      'iframe',
      'svg',
      'math',
      'form',
      'input',
      'button',
      'object',
      'base',
      'meta',
      'link',
    ]) {
      expect(root.querySelector(tag), tag).toBeNull();
    }
    for (const el of root.querySelectorAll('*')) {
      for (const attr of el.attributes) {
        expect(attr.name, `${el.tagName} ${attr.name}`).not.toMatch(
          /^on|^srcdoc$|^src$|^action$|^formaction$|^class$|^id$/
        );
      }
    }
    for (const a of root.querySelectorAll('a[href]')) {
      const url = new URL(a.getAttribute('href')!, 'https://rollkeeper.test/');
      expect(['http:', 'https:', 'mailto:']).toContain(url.protocol);
    }
    for (const el of root.querySelectorAll('[style]')) {
      expect(el.tagName).toBe('SPAN');
      expect(el.getAttribute('style')).toMatch(/^color: [^;]+;$/);
    }
  });
});

describe('sanitizeRichText cost', () => {
  it.each([
    [
      'a long run of spaces in an href',
      `<a href="a${' '.repeat(200_000)}b">x</a>`,
    ],
    [
      'a long run of controls in an href',
      `<a href="a${'\u0001'.repeat(200_000)}b">x</a>`,
    ],
    ['an unclosed tag flood', '<a'.repeat(500_000)],
    ['a closing tag flood', '<p>'.repeat(5_000) + '</div>'.repeat(200_000)],
  ])('stays linear on %s', (_name, input) => {
    const start = performance.now();
    sanitizeRichText(input);
    expect(performance.now() - start).toBeLessThan(1_000);
  });
});
