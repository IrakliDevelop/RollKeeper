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
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
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

interface CompactRichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  minHeight?: string;
  ariaLabel?: string;
}

const selectToolbarState = (e: Editor) => ({
  bold: e.isActive('bold'),
  italic: e.isActive('italic'),
  underline: e.isActive('underline'),
  bulletList: e.isActive('bulletList'),
  orderedList: e.isActive('orderedList'),
  isEmpty: e.isEmpty,
});

type ToggleKey = Exclude<
  keyof ReturnType<typeof selectToolbarState>,
  'isEmpty'
>;

interface ToolbarItem {
  label: string;
  icon: LucideIcon;
  run: (chain: ChainedCommands) => ChainedCommands;
  active: ToggleKey;
}

const TOOL_GROUPS: ToolbarItem[][] = [
  [
    { label: 'Bold', icon: Bold, run: c => c.toggleBold(), active: 'bold' },
    {
      label: 'Italic',
      icon: Italic,
      run: c => c.toggleItalic(),
      active: 'italic',
    },
    {
      label: 'Underline',
      icon: UnderlineIcon,
      run: c => c.toggleUnderline(),
      active: 'underline',
    },
  ],
  [
    {
      label: 'Bullet list',
      icon: List,
      run: c => c.toggleBulletList(),
      active: 'bulletList',
    },
    {
      label: 'Numbered list',
      icon: ListOrdered,
      run: c => c.toggleOrderedList(),
      active: 'orderedList',
    },
  ],
];

const EDITOR_CSS =
  richTextProseCss('.rk-crte .ProseMirror') + richTextEditorCss('.rk-crte');

export function CompactRichTextEditor({
  content,
  onChange,
  placeholder = '',
  minHeight = '80px',
  ariaLabel,
}: CompactRichTextEditorProps) {
  const [isMounted, setIsMounted] = useState(false);
  const roving = useToolbarRoving<HTMLDivElement>();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
      }),
    ],
    content,
    immediatelyRender: false,
    onUpdate: ({ editor: e }) => {
      onChange(e.getHTML());
    },
    editorProps: {
      attributes: {
        role: 'textbox',
        'aria-multiline': 'true',
        class: 'focus:outline-none',
        style: `min-height: ${minHeight}; padding: 8px 10px;`,
        ...(ariaLabel ? { 'aria-label': ariaLabel } : {}),
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
    return <div className={RICH_TEXT_LOADING_CLASS} style={{ minHeight }} />;
  }

  return (
    <TooltipProvider>
      <div className={RICH_TEXT_FRAME_CLASS}>
        <div
          role="toolbar"
          aria-label={ariaLabel ? `${ariaLabel} formatting` : undefined}
          ref={roving.ref}
          onKeyDown={roving.onKeyDown}
          onFocus={roving.onFocus}
          className={`${RICH_TEXT_TOOLBAR_CLASS} p-0.5`}
        >
          {TOOL_GROUPS.map((group, index) => (
            <React.Fragment key={group[0].label}>
              {index > 0 && (
                <span aria-hidden className={RICH_TEXT_DIVIDER_CLASS} />
              )}
              <div className="flex items-center gap-1">
                {group.map(item => (
                  <ToolbarButton
                    key={item.label}
                    label={item.label}
                    icon={item.icon}
                    onClick={() => item.run(editor.chain().focus()).run()}
                    active={state[item.active]}
                  />
                ))}
              </div>
            </React.Fragment>
          ))}
        </div>
        <div
          className={`rk-crte ${RICH_TEXT_WELL_CLASS} type-small`}
          style={{ minHeight }}
        >
          <EditorContent editor={editor} />
          {placeholder && state.isEmpty && (
            <div
              aria-hidden
              className={`${RICH_TEXT_PLACEHOLDER_CLASS} top-2 left-2.5`}
            >
              {placeholder}
            </div>
          )}
        </div>
        <style href="rk-crte" precedence="rk-rich-text">
          {EDITOR_CSS}
        </style>
      </div>
    </TooltipProvider>
  );
}
