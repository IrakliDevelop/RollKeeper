'use client';

import React, { useState, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
} from 'lucide-react';

interface CompactRichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  minHeight?: string;
}

export function CompactRichTextEditor({
  content,
  onChange,
  placeholder = 'Description...',
  minHeight = '80px',
}: CompactRichTextEditorProps) {
  const [isMounted, setIsMounted] = useState(false);

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
      Underline,
    ],
    content,
    immediatelyRender: false,
    onUpdate: ({ editor: e }) => {
      onChange(e.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'focus:outline-none',
        style: `min-height: ${minHeight}; padding: 8px 10px;`,
      },
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [editor, content]);

  if (!isMounted || !editor) {
    return (
      <div
        className="border-divider bg-surface rounded border"
        style={{ minHeight }}
      />
    );
  }

  return (
    <div className="border-divider bg-surface overflow-hidden rounded-md border">
      {/* Compact toolbar */}
      <div className="border-divider bg-surface-secondary flex items-center gap-0.5 border-b px-1.5 py-1">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          title="Bold"
        >
          <Bold size={13} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          title="Italic"
        >
          <Italic size={13} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive('underline')}
          title="Underline"
        >
          <UnderlineIcon size={13} />
        </ToolbarButton>
        <div className="bg-divider mx-1 h-4 w-px" />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          title="Bullet List"
        >
          <List size={13} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          title="Numbered List"
        >
          <ListOrdered size={13} />
        </ToolbarButton>
      </div>

      {/* Editor */}
      <div className="bg-surface relative" style={{ minHeight }}>
        <EditorContent editor={editor} className="compact-rte-content" />
        {editor.isEmpty && (
          <div className="text-faint pointer-events-none absolute top-2 left-2.5 text-sm">
            {placeholder}
          </div>
        )}
      </div>

      <style jsx global>{`
        .compact-rte-content .ProseMirror {
          outline: none !important;
          color: var(--body);
          font-size: 0.8125rem;
          line-height: 1.5;
          min-height: inherit !important;
        }
        .compact-rte-content .ProseMirror p {
          margin: 0.25rem 0 !important;
        }
        .compact-rte-content .ProseMirror ul {
          list-style-type: disc !important;
          padding-left: 1.25rem !important;
          margin: 0.25rem 0 !important;
        }
        .compact-rte-content .ProseMirror ol {
          list-style-type: decimal !important;
          padding-left: 1.25rem !important;
          margin: 0.25rem 0 !important;
        }
        .compact-rte-content .ProseMirror li {
          display: list-item !important;
          margin: 0.125rem 0 !important;
        }
        .compact-rte-content .ProseMirror li p {
          display: inline !important;
          margin: 0 !important;
        }
        .compact-rte-content .ProseMirror strong {
          font-weight: 700 !important;
        }
        .compact-rte-content .ProseMirror em {
          font-style: italic !important;
        }
        .compact-rte-content .ProseMirror u {
          text-decoration: underline !important;
        }
        .compact-rte-content .ProseMirror > *:first-child {
          margin-top: 0 !important;
        }
        .compact-rte-content .ProseMirror > *:last-child {
          margin-bottom: 0 !important;
        }
      `}</style>
    </div>
  );
}

function ToolbarButton({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void;
  active: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded p-1 transition-colors ${
        active
          ? 'bg-accent-blue-bg-strong text-accent-blue-text'
          : 'text-muted hover:text-body hover:bg-surface'
      }`}
      title={title}
    >
      {children}
    </button>
  );
}
