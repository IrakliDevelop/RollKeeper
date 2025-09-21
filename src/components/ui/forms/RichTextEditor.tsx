'use client';

import React, { useState, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import {
  Bold,
  Italic,
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
} from 'lucide-react';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
}

export default function RichTextEditor({
  content,
  onChange,
  placeholder = 'Start writing...',
  className = '',
  minHeight = '200px',
}: RichTextEditorProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const editor = useEditor({
    extensions: [StarterKit, TextStyle, Color],
    content,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'focus:outline-none',
        style: `min-height: ${minHeight}; padding: 16px;`,
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
        className={`rounded-lg border border-gray-300 bg-gray-50 ${className}`}
        style={{ minHeight }}
      >
        <div className="flex h-full items-center justify-center text-gray-500">
          Loading editor...
        </div>
      </div>
    );
  }

  return (
    <div
      className={`overflow-hidden rounded-lg border border-gray-300 bg-white shadow-sm ${className}`}
    >
      {/* Fixed Toolbar */}
      <div className="flex flex-wrap items-center gap-1 border-b border-gray-200 bg-gray-50 p-3">
        {/* Text Formatting */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            disabled={!editor.can().chain().focus().toggleBold().run()}
            className={`rounded p-2 text-gray-600 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50 ${
              editor.isActive('bold') ? 'bg-blue-200 text-blue-900' : ''
            }`}
            title="Bold"
          >
            <Bold size={16} />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            disabled={!editor.can().chain().focus().toggleItalic().run()}
            className={`rounded p-2 text-gray-600 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50 ${
              editor.isActive('italic') ? 'bg-blue-200 text-blue-900' : ''
            }`}
            title="Italic"
          >
            <Italic size={16} />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleStrike().run()}
            disabled={!editor.can().chain().focus().toggleStrike().run()}
            className={`rounded p-2 text-gray-600 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50 ${
              editor.isActive('strike') ? 'bg-blue-200 text-blue-900' : ''
            }`}
            title="Strikethrough"
          >
            <Strikethrough size={16} />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleCode().run()}
            disabled={!editor.can().chain().focus().toggleCode().run()}
            className={`rounded p-2 text-gray-600 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50 ${
              editor.isActive('code') ? 'bg-blue-200 text-blue-900' : ''
            }`}
            title="Inline Code"
          >
            <Code size={16} />
          </button>
        </div>

        <div className="mx-2 h-6 w-px bg-gray-300" />

        {/* Headings */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 1 }).run()
            }
            className={`rounded p-2 text-gray-600 transition-colors hover:bg-gray-200 ${
              editor.isActive('heading', { level: 1 })
                ? 'bg-blue-200 text-blue-900'
                : ''
            }`}
            title="Heading 1"
          >
            <Heading1 size={16} />
          </button>

          <button
            type="button"
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 2 }).run()
            }
            className={`rounded p-2 text-gray-600 transition-colors hover:bg-gray-200 ${
              editor.isActive('heading', { level: 2 })
                ? 'bg-blue-200 text-blue-900'
                : ''
            }`}
            title="Heading 2"
          >
            <Heading2 size={16} />
          </button>

          <button
            type="button"
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 3 }).run()
            }
            className={`rounded p-2 text-gray-600 transition-colors hover:bg-gray-200 ${
              editor.isActive('heading', { level: 3 })
                ? 'bg-blue-200 text-blue-900'
                : ''
            }`}
            title="Heading 3"
          >
            <Heading3 size={16} />
          </button>
        </div>

        <div className="mx-2 h-6 w-px bg-gray-300" />

        {/* Lists and Blocks */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`rounded p-2 text-gray-600 transition-colors hover:bg-gray-200 ${
              editor.isActive('bulletList') ? 'bg-blue-200 text-blue-900' : ''
            }`}
            title="Bullet List"
          >
            <List size={16} />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`rounded p-2 text-gray-600 transition-colors hover:bg-gray-200 ${
              editor.isActive('orderedList') ? 'bg-blue-200 text-blue-900' : ''
            }`}
            title="Numbered List"
          >
            <ListOrdered size={16} />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={`rounded p-2 text-gray-600 transition-colors hover:bg-gray-200 ${
              editor.isActive('blockquote') ? 'bg-blue-200 text-blue-900' : ''
            }`}
            title="Blockquote"
          >
            <Quote size={16} />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            className="rounded p-2 text-gray-600 transition-colors hover:bg-gray-200"
            title="Horizontal Rule"
          >
            <Minus size={16} />
          </button>
        </div>

        <div className="mx-2 h-6 w-px bg-gray-300" />

        {/* Utility */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() =>
              editor.chain().focus().clearNodes().unsetAllMarks().run()
            }
            className="rounded p-2 text-gray-600 transition-colors hover:bg-gray-200"
            title="Clear Formatting"
          >
            <Type size={16} />
          </button>
        </div>

        <div className="flex-1" />

        {/* Undo/Redo */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().chain().focus().undo().run()}
            className="rounded p-2 text-gray-600 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
            title="Undo"
          >
            <Undo size={16} />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().chain().focus().redo().run()}
            className="rounded p-2 text-gray-600 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
            title="Redo"
          >
            <Redo size={16} />
          </button>
        </div>
      </div>

      {/* Editor Container */}
      <div className="relative bg-white" style={{ minHeight }}>
        <EditorContent editor={editor} className="rich-text-editor-content" />

        {/* Placeholder when empty */}
        {editor.isEmpty && (
          <div className="pointer-events-none absolute top-4 left-4 text-gray-400">
            {placeholder}
          </div>
        )}
      </div>

      {/* Editor Styles */}
      <style jsx global>{`
        .rich-text-editor-content .ProseMirror {
          outline: none !important;
          color: #1f2937;
          font-family:
            -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background-color: white !important;
          min-height: inherit !important;
          height: 100% !important;
        }

        /* Ensure editor content container fills available space */
        .rich-text-editor-content {
          background-color: white !important;
          min-height: inherit !important;
          height: 100% !important;
        }

        /* Reset conflicting styles but preserve necessary ones */
        .rich-text-editor-content .ProseMirror > * {
          color: inherit;
        }

        /* Headings */
        .rich-text-editor-content .ProseMirror h1 {
          font-size: 2.25rem !important;
          font-weight: 800 !important;
          line-height: 1.2 !important;
          margin: 2rem 0 1rem 0 !important;
          color: #111827 !important;
          display: block !important;
        }

        .rich-text-editor-content .ProseMirror h2 {
          font-size: 1.875rem !important;
          font-weight: 700 !important;
          line-height: 1.3 !important;
          margin: 1.5rem 0 0.75rem 0 !important;
          color: #111827 !important;
          display: block !important;
        }

        .rich-text-editor-content .ProseMirror h3 {
          font-size: 1.5rem !important;
          font-weight: 600 !important;
          line-height: 1.4 !important;
          margin: 1.25rem 0 0.5rem 0 !important;
          color: #111827 !important;
          display: block !important;
        }

        /* Paragraphs */
        .rich-text-editor-content .ProseMirror p {
          margin: 0.75rem 0 !important;
          line-height: 1.7 !important;
          display: block !important;
        }

        /* Lists */
        .rich-text-editor-content .ProseMirror ul {
          list-style-type: disc !important;
          margin: 1rem 0 !important;
          padding-left: 1.5rem !important;
          display: block !important;
        }

        .rich-text-editor-content .ProseMirror ol {
          list-style-type: decimal !important;
          margin: 1rem 0 !important;
          padding-left: 1.5rem !important;
          display: block !important;
        }

        .rich-text-editor-content .ProseMirror li {
          margin: 0.25rem 0 !important;
          line-height: 1.6 !important;
          display: list-item !important;
          list-style-position: outside !important;
        }

        .rich-text-editor-content .ProseMirror li p {
          margin: 0.25rem 0 !important;
          display: inline !important;
        }

        /* Text formatting */
        .rich-text-editor-content .ProseMirror strong {
          font-weight: 700 !important;
        }

        .rich-text-editor-content .ProseMirror em {
          font-style: italic !important;
        }

        .rich-text-editor-content .ProseMirror s {
          text-decoration: line-through !important;
        }

        /* Code */
        .rich-text-editor-content .ProseMirror code {
          background-color: #f3f4f6 !important;
          color: #dc2626 !important;
          padding: 0.25rem 0.375rem !important;
          border-radius: 0.25rem !important;
          font-size: 0.875em !important;
          font-family:
            'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'Courier New',
            monospace !important;
          border: 1px solid #e5e7eb !important;
        }

        .rich-text-editor-content .ProseMirror pre {
          background: #1e1e1e !important;
          color: #fff !important;
          font-family:
            'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'Courier New',
            monospace !important;
          padding: 1rem !important;
          border-radius: 0.5rem !important;
          margin: 1rem 0 !important;
          overflow-x: auto !important;
          display: block !important;
        }

        .rich-text-editor-content .ProseMirror pre code {
          color: inherit !important;
          padding: 0 !important;
          background: none !important;
          font-size: inherit !important;
          border: none !important;
        }

        /* Blockquote */
        .rich-text-editor-content .ProseMirror blockquote {
          padding: 1rem !important;
          border-left: 4px solid #3b82f6 !important;
          margin: 1rem 0 !important;
          font-style: italic !important;
          color: #6b7280 !important;
          display: block !important;
          background-color: #f8fafc !important;
          border-radius: 0.5rem !important;
        }

        /* Horizontal Rule */
        .rich-text-editor-content .ProseMirror hr {
          border: none !important;
          border-top: 2px solid #e5e7eb !important;
          margin: 2rem 0 !important;
          display: block !important;
          width: 100% !important;
        }

        /* First and last child margin reset */
        .rich-text-editor-content .ProseMirror > *:first-child {
          margin-top: 0 !important;
        }

        .rich-text-editor-content .ProseMirror > *:last-child {
          margin-bottom: 0 !important;
        }
      `}</style>
    </div>
  );
}
