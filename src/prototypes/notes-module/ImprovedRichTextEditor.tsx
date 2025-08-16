'use client';

import React, { useState, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle } from '@tiptap/extension-text-style';
import { BulletList } from '@tiptap/extension-bullet-list';
import { OrderedList } from '@tiptap/extension-ordered-list';
import { ListItem } from '@tiptap/extension-list-item';
import { 
  Bold, 
  Italic, 
  List, 
  ListOrdered, 
  Heading1, 
  Heading2, 
  Undo, 
  Redo,
  Type,
  Code
} from 'lucide-react';

interface ImprovedRichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
}

export default function ImprovedRichTextEditor({
  content,
  onChange,
  placeholder = 'Start typing...',
  className = '',
  minHeight = '200px'
}: ImprovedRichTextEditorProps) {
  const [isMounted, setIsMounted] = useState(false);

  // Ensure component only renders on client side
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable built-in extensions that we want to configure explicitly
        bulletList: false,
        orderedList: false,
        listItem: false,
        heading: {
          levels: [1, 2, 3, 4, 5, 6],
        },
        // Make sure code blocks work
        codeBlock: {
          HTMLAttributes: {
            class: 'bg-gray-100 rounded p-2 text-sm font-mono',
          },
        },
      }),
      // Explicitly configured list extensions to fix conflicts
      BulletList.configure({
        HTMLAttributes: {
          class: 'prose-bullet-list',
        },
        keepMarks: true,
        keepAttributes: false,
      }),
      OrderedList.configure({
        HTMLAttributes: {
          class: 'prose-ordered-list',
        },
        keepMarks: true,
        keepAttributes: false,
      }),
      ListItem.configure({
        HTMLAttributes: {
          class: 'prose-list-item',
        },
      }),
      TextStyle,
    ],
    content,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: `focus:outline-none prose prose-lg max-w-none px-4 py-3`,
        style: `min-height: ${minHeight}`,
      },
    },
  }, []);

  // Update editor content when prop changes
  useEffect(() => {
    if (editor && isMounted && content !== editor.getHTML()) {
      const timeoutId = setTimeout(() => {
        if (editor && content !== editor.getHTML()) {
          editor.commands.setContent(content);
        }
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [editor, content, isMounted]);

  // Don't render on server side
  if (!isMounted || !editor) {
    return (
      <div 
        className={`border border-gray-300 rounded-lg bg-gray-50 ${className}`}
        style={{ minHeight }}
      >
        <div className="flex items-center justify-center h-full text-gray-500">
          Loading enhanced editor...
        </div>
      </div>
    );
  }

  // Editor commands
  const toggleBold = () => editor.chain().focus().toggleBold().run();
  const toggleItalic = () => editor.chain().focus().toggleItalic().run();
  const toggleCode = () => editor.chain().focus().toggleCode().run();
  const toggleBulletList = () => editor.chain().focus().toggleBulletList().run();
  const toggleOrderedList = () => editor.chain().focus().toggleOrderedList().run();
  const toggleHeading1 = () => editor.chain().focus().toggleHeading({ level: 1 }).run();
  const toggleHeading2 = () => editor.chain().focus().toggleHeading({ level: 2 }).run();
  const undo = () => editor.chain().focus().undo().run();
  const redo = () => editor.chain().focus().redo().run();
  const clearFormatting = () => editor.chain().focus().clearNodes().unsetAllMarks().run();

  return (
    <div className={`border border-gray-300 rounded-lg overflow-hidden bg-white shadow-sm ${className}`}>
      {/* Enhanced Toolbar */}
      <div className="flex items-center gap-1 p-3 border-b border-gray-200 bg-gray-50">
        {/* Text Formatting */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={toggleBold}
            className={`p-2 rounded text-gray-600 hover:bg-gray-200 transition-colors ${
              editor.isActive('bold') ? 'bg-blue-200 text-blue-900' : ''
            }`}
            title="Bold (Ctrl+B)"
          >
            <Bold size={16} />
          </button>
          
          <button
            type="button"
            onClick={toggleItalic}
            className={`p-2 rounded text-gray-600 hover:bg-gray-200 transition-colors ${
              editor.isActive('italic') ? 'bg-blue-200 text-blue-900' : ''
            }`}
            title="Italic (Ctrl+I)"
          >
            <Italic size={16} />
          </button>

          <button
            type="button"
            onClick={toggleCode}
            className={`p-2 rounded text-gray-600 hover:bg-gray-200 transition-colors ${
              editor.isActive('code') ? 'bg-blue-200 text-blue-900' : ''
            }`}
            title="Inline Code"
          >
            <Code size={16} />
          </button>
        </div>

        <div className="w-px h-6 bg-gray-300 mx-2" />

        {/* Headings */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={toggleHeading1}
            className={`p-2 rounded text-gray-600 hover:bg-gray-200 transition-colors ${
              editor.isActive('heading', { level: 1 }) ? 'bg-blue-200 text-blue-900' : ''
            }`}
            title="Heading 1"
          >
            <Heading1 size={16} />
          </button>

          <button
            type="button"
            onClick={toggleHeading2}
            className={`p-2 rounded text-gray-600 hover:bg-gray-200 transition-colors ${
              editor.isActive('heading', { level: 2 }) ? 'bg-blue-200 text-blue-900' : ''
            }`}
            title="Heading 2"
          >
            <Heading2 size={16} />
          </button>
        </div>

        <div className="w-px h-6 bg-gray-300 mx-2" />

        {/* Lists */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={toggleBulletList}
            className={`p-2 rounded text-gray-600 hover:bg-gray-200 transition-colors ${
              editor.isActive('bulletList') ? 'bg-blue-200 text-blue-900' : ''
            }`}
            title="Bullet List"
          >
            <List size={16} />
          </button>

          <button
            type="button"
            onClick={toggleOrderedList}
            className={`p-2 rounded text-gray-600 hover:bg-gray-200 transition-colors ${
              editor.isActive('orderedList') ? 'bg-blue-200 text-blue-900' : ''
            }`}
            title="Numbered List"
          >
            <ListOrdered size={16} />
          </button>
        </div>

        <div className="w-px h-6 bg-gray-300 mx-2" />

        {/* Utility */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={clearFormatting}
            className="p-2 rounded text-gray-600 hover:bg-gray-200 transition-colors"
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
            onClick={undo}
            disabled={!editor.can().undo()}
            className="p-2 rounded text-gray-600 hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Undo (Ctrl+Z)"
          >
            <Undo size={16} />
          </button>

          <button
            type="button"
            onClick={redo}
            disabled={!editor.can().redo()}
            className="p-2 rounded text-gray-600 hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Redo (Ctrl+Y)"
          >
            <Redo size={16} />
          </button>
        </div>
      </div>

      {/* Editor Container */}
      <div className="relative">
        <EditorContent 
          editor={editor} 
          className="notes-editor-content"
        />
        
        {/* Placeholder when empty */}
        {editor.isEmpty && (
          <div className="absolute top-4 left-4 text-gray-400 pointer-events-none">
            {placeholder}
          </div>
        )}
      </div>
      
      {/* Basic styles for editor content - let global CSS handle colors */}
      <style jsx>{`
        .notes-editor-content :global(.ProseMirror) {
          outline: none;
          padding: 1rem;
        }
        
        .notes-editor-content :global(h1) {
          font-size: 1.875rem;
          font-weight: 700;
          line-height: 1.2;
          margin: 1.5rem 0 1rem 0;
          border-bottom: 2px solid #e5e7eb;
          padding-bottom: 0.5rem;
        }
        
        .notes-editor-content :global(h2) {
          font-size: 1.5rem;
          font-weight: 600;
          line-height: 1.3;
          margin: 1.25rem 0 0.75rem 0;
        }
        
        .notes-editor-content :global(h3) {
          font-size: 1.25rem;
          font-weight: 600;
          line-height: 1.4;
          margin: 1rem 0 0.5rem 0;
        }
        
        .notes-editor-content :global(p) {
          margin: 0.75rem 0;
          line-height: 1.6;
        }
        
        .notes-editor-content :global(.prose-bullet-list) {
          list-style-type: disc;
          margin: 1rem 0;
          padding-left: 1.5rem;
        }
        
        .notes-editor-content :global(.prose-ordered-list) {
          list-style-type: decimal;
          margin: 1rem 0;
          padding-left: 1.5rem;
        }
        
        .notes-editor-content :global(.prose-list-item) {
          margin: 0.5rem 0;
          line-height: 1.5;
        }
        
        .notes-editor-content :global(strong) {
          font-weight: 600;
        }
        
        .notes-editor-content :global(em) {
          font-style: italic;
        }
        
        .notes-editor-content :global(code) {
          background-color: #f3f4f6;
          color: #dc2626;
          padding: 0.125rem 0.25rem;
          border-radius: 0.25rem;
          font-size: 0.875em;
          font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
        }
        
        .notes-editor-content :global(pre) {
          background-color: #1f2937;
          color: #f9fafb;
          padding: 1rem;
          border-radius: 0.5rem;
          margin: 1rem 0;
          overflow-x: auto;
          font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
        }
        
        .notes-editor-content :global(blockquote) {
          border-left: 4px solid #3b82f6;
          padding-left: 1rem;
          margin: 1rem 0;
          font-style: italic;
        }
      `}</style>
    </div>
  );
}
