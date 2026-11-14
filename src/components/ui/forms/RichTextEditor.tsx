'use client';

import React, { useState, useEffect } from 'react';
import {
  useEditor,
  useEditorState,
  EditorContent,
  type ChainedCommands,
  type Editor,
} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { TableKit } from '@tiptap/extension-table';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Undo,
  Redo,
  Type,
  Minus,
  Table,
  TableCellsMerge,
  TableCellsSplit,
  Columns2,
  Rows2,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { TooltipProvider } from '@/components/ui/primitives/Tooltip';
import { ToolbarButton } from './richText/ToolbarButton';
import { useToolbarRoving } from './richText/useToolbarRoving';
import {
  RICH_TEXT_DIVIDER_CLASS,
  RICH_TEXT_FRAME_CLASS,
  RICH_TEXT_LOADING_CLASS,
  RICH_TEXT_PLACEHOLDER_CLASS,
  RICH_TEXT_TOOLBAR_CLASS,
  RICH_TEXT_WELL_CLASS,
  richTextEditorCss,
  richTextProseCss,
} from './richText/prose';

interface RichTextEditorProps {
  ariaLabel: string;
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
}

const selectToolbarState = (e: Editor) => ({
  isBold: e.isActive('bold'),
  isItalic: e.isActive('italic'),
  isUnderline: e.isActive('underline'),
  isStrike: e.isActive('strike'),
  isCode: e.isActive('code'),
  isH1: e.isActive('heading', { level: 1 }),
  isH2: e.isActive('heading', { level: 2 }),
  isH3: e.isActive('heading', { level: 3 }),
  isBulletList: e.isActive('bulletList'),
  isOrderedList: e.isActive('orderedList'),
  isQuote: e.isActive('blockquote'),
  canBold: e.can().toggleBold(),
  canItalic: e.can().toggleItalic(),
  canUnderline: e.can().toggleUnderline(),
  canStrike: e.can().toggleStrike(),
  canCode: e.can().toggleCode(),
  canUndo: e.can().undo(),
  canRedo: e.can().redo(),
  inTable: e.isActive('table'),
  canAddColumn: e.can().addColumnAfter(),
  canAddRow: e.can().addRowAfter(),
  canMerge: e.can().mergeCells(),
  canSplit: e.can().splitCell(),
  canDeleteTable: e.can().deleteTable(),
  isEmpty: e.isEmpty,
});

type StateKey = keyof ReturnType<typeof selectToolbarState>;

interface ToolbarItem {
  label: string;
  icon: LucideIcon;
  run: (chain: ChainedCommands) => ChainedCommands;
  active?: StateKey;
  enabled?: StateKey;
  inTableOnly?: true;
}

const TOOL_GROUPS: ToolbarItem[][] = [
  [
    {
      label: 'Bold',
      icon: Bold,
      run: c => c.toggleBold(),
      active: 'isBold',
      enabled: 'canBold',
    },
    {
      label: 'Italic',
      icon: Italic,
      run: c => c.toggleItalic(),
      active: 'isItalic',
      enabled: 'canItalic',
    },
    {
      label: 'Underline',
      icon: UnderlineIcon,
      run: c => c.toggleUnderline(),
      active: 'isUnderline',
      enabled: 'canUnderline',
    },
    {
      label: 'Strikethrough',
      icon: Strikethrough,
      run: c => c.toggleStrike(),
      active: 'isStrike',
      enabled: 'canStrike',
    },
    {
      label: 'Inline code',
      icon: Code,
      run: c => c.toggleCode(),
      active: 'isCode',
      enabled: 'canCode',
    },
  ],
  [
    {
      label: 'Heading 1',
      icon: Heading1,
      run: c => c.toggleHeading({ level: 1 }),
      active: 'isH1',
    },
    {
      label: 'Heading 2',
      icon: Heading2,
      run: c => c.toggleHeading({ level: 2 }),
      active: 'isH2',
    },
    {
      label: 'Heading 3',
      icon: Heading3,
      run: c => c.toggleHeading({ level: 3 }),
      active: 'isH3',
    },
  ],
  [
    {
      label: 'Bullet list',
      icon: List,
      run: c => c.toggleBulletList(),
      active: 'isBulletList',
    },
    {
      label: 'Numbered list',
      icon: ListOrdered,
      run: c => c.toggleOrderedList(),
      active: 'isOrderedList',
    },
    {
      label: 'Quote',
      icon: Quote,
      run: c => c.toggleBlockquote(),
      active: 'isQuote',
    },
    { label: 'Horizontal line', icon: Minus, run: c => c.setHorizontalRule() },
  ],
  [
    {
      label: 'Insert table',
      icon: Table,
      run: c => c.insertTable({ rows: 3, cols: 3, withHeaderRow: true }),
    },
    {
      label: 'Add column',
      icon: Columns2,
      run: c => c.addColumnAfter(),
      enabled: 'canAddColumn',
      inTableOnly: true,
    },
    {
      label: 'Add row',
      icon: Rows2,
      run: c => c.addRowAfter(),
      enabled: 'canAddRow',
      inTableOnly: true,
    },
    {
      label: 'Merge cells',
      icon: TableCellsMerge,
      run: c => c.mergeCells(),
      enabled: 'canMerge',
      inTableOnly: true,
    },
    {
      label: 'Split cell',
      icon: TableCellsSplit,
      run: c => c.splitCell(),
      enabled: 'canSplit',
      inTableOnly: true,
    },
    {
      label: 'Delete table',
      icon: Trash2,
      run: c => c.deleteTable(),
      enabled: 'canDeleteTable',
      inTableOnly: true,
    },
  ],
  [
    {
      label: 'Clear formatting',
      icon: Type,
      run: c => c.clearNodes().unsetAllMarks(),
    },
  ],
];

const HISTORY_TOOLS: ToolbarItem[] = [
  { label: 'Undo', icon: Undo, run: c => c.undo(), enabled: 'canUndo' },
  { label: 'Redo', icon: Redo, run: c => c.redo(), enabled: 'canRedo' },
];

const EDITOR_CSS =
  richTextProseCss('.rk-rte .ProseMirror') + richTextEditorCss('.rk-rte');

export default function RichTextEditor({
  ariaLabel,
  content,
  onChange,
  placeholder = '',
  className = '',
  minHeight = '200px',
}: RichTextEditorProps) {
  const [isMounted, setIsMounted] = useState(false);
  const roving = useToolbarRoving<HTMLDivElement>();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextStyle,
      Color,
      TableKit.configure({
        table: {
          resizable: true,
        },
      }),
    ],
    content,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        'aria-label': ariaLabel,
        role: 'textbox',
        'aria-multiline': 'true',
        class: 'focus:outline-none',
        style: `min-height: ${minHeight}; padding: 16px;`,
      },
    },
  });

  // The hook's snapshot stays null until the first transaction, so read the
  // editor directly until then.
  const liveState = useEditorState({
    editor,
    selector: ({ editor: e }) => (e ? selectToolbarState(e) : null),
  });
  const state = liveState ?? (editor ? selectToolbarState(editor) : null);

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [editor, content]);

  if (!isMounted || !editor || !state) {
    return (
      <div
        className={`${RICH_TEXT_LOADING_CLASS} ${className}`}
        style={{ minHeight }}
      />
    );
  }

  const renderTool = (item: ToolbarItem) => (
    <ToolbarButton
      key={item.label}
      label={item.label}
      icon={item.icon}
      onClick={() => item.run(editor.chain().focus()).run()}
      active={item.active ? state[item.active] : undefined}
      disabled={item.enabled ? !state[item.enabled] : undefined}
    />
  );

  return (
    <TooltipProvider>
      <div className={`${RICH_TEXT_FRAME_CLASS} ${className}`}>
        <div
          role="toolbar"
          aria-label={`${ariaLabel} formatting`}
          ref={roving.ref}
          onKeyDown={roving.onKeyDown}
          onFocus={roving.onFocus}
          className={`${RICH_TEXT_TOOLBAR_CLASS} p-1`}
        >
          {TOOL_GROUPS.map((group, index) => (
            <React.Fragment key={group[0].label}>
              {index > 0 && (
                <span aria-hidden className={RICH_TEXT_DIVIDER_CLASS} />
              )}
              <div className="flex items-center gap-1">
                {group
                  .filter(item => !item.inTableOnly || state.inTable)
                  .map(renderTool)}
              </div>
            </React.Fragment>
          ))}
          <div className="flex-1" />
          <div className="flex items-center gap-1">
            {HISTORY_TOOLS.map(renderTool)}
          </div>
        </div>
        <div
          className={`rk-rte ${RICH_TEXT_WELL_CLASS} type-body`}
          style={{ minHeight }}
        >
          <EditorContent editor={editor} />
          {placeholder && state.isEmpty && (
            <div
              aria-hidden
              className={`${RICH_TEXT_PLACEHOLDER_CLASS} top-4 left-4`}
            >
              {placeholder}
            </div>
          )}
        </div>
        <style href="rk-rte" precedence="rk-rich-text">
          {EDITOR_CSS}
        </style>
      </div>
    </TooltipProvider>
  );
}
