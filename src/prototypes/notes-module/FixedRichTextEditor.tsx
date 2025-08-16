'use client';

import React, { useState, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
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

interface FixedRichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
}

export default function FixedRichTextEditor({
  content,
  onChange,
  placeholder = 'Start typing...',
  className = '',
  minHeight = '200px'
}: FixedRichTextEditorProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const editor = useEditor({
    extensions: [
      // Use StarterKit with minimal configuration to avoid conflicts
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4, 5, 6],
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
        class: `focus:outline-none prose prose-lg max-w-none px-4 py-3`,
        style: `min-height: ${minHeight}`,
      },
    },
  }, []);

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

  if (!isMounted || !editor) {
    return (
      <div 
        className={`border border-gray-300 rounded-lg bg-gray-50 ${className}`}
        style={{ minHeight }}
      >
        <div className="flex items-center justify-center h-full text-gray-500">
          Loading fixed editor...
        </div>
      </div>
    );
  }

  // Editor commands - using chain() for better reliability
  const toggleBold = () => {
    editor.chain().focus().toggleBold().run();
  };
  
  const toggleItalic = () => {
    editor.chain().focus().toggleItalic().run();
  };
  
  const toggleCode = () => {
    editor.chain().focus().toggleCode().run();
  };
  
  const toggleBulletList = () => {
    editor.chain().focus().toggleBulletList().run();
  };
  
  const toggleOrderedList = () => {
    editor.chain().focus().toggleOrderedList().run();
  };
  
  const toggleHeading1 = () => {
    editor.chain().focus().toggleHeading({ level: 1 }).run();
  };
  
  const toggleHeading2 = () => {
    editor.chain().focus().toggleHeading({ level: 2 }).run();
  };
  
  const undo = () => {
    editor.chain().focus().undo().run();
  };
  
  const redo = () => {
    editor.chain().focus().redo().run();
  };
  
  const clearFormatting = () => {
    editor.chain().focus().clearNodes().unsetAllMarks().run();
  };

  return (
    <div className={`border border-gray-300 rounded-lg overflow-hidden bg-white shadow-sm ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-3 border-b border-gray-200 bg-gray-50">
        {/* Text Formatting */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={toggleBold}
            disabled={!editor.can().chain().focus().toggleBold().run()}
            className={`p-2 rounded text-gray-600 hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              editor.isActive('bold') ? 'bg-blue-200 text-blue-900' : ''
            }`}
            title="Bold (Ctrl+B)"
          >
            <Bold size={16} />
          </button>
          
          <button
            type="button"
            onClick={toggleItalic}
            disabled={!editor.can().chain().focus().toggleItalic().run()}
            className={`p-2 rounded text-gray-600 hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              editor.isActive('italic') ? 'bg-blue-200 text-blue-900' : ''
            }`}
            title="Italic (Ctrl+I)"
          >
            <Italic size={16} />
          </button>

          <button
            type="button"
            onClick={toggleCode}
            disabled={!editor.can().chain().focus().toggleCode().run()}
            className={`p-2 rounded text-gray-600 hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
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
            disabled={!editor.can().chain().focus().toggleHeading({ level: 1 }).run()}
            className={`p-2 rounded text-gray-600 hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              editor.isActive('heading', { level: 1 }) ? 'bg-blue-200 text-blue-900' : ''
            }`}
            title="Heading 1"
          >
            <Heading1 size={16} />
          </button>

          <button
            type="button"
            onClick={toggleHeading2}
            disabled={!editor.can().chain().focus().toggleHeading({ level: 2 }).run()}
            className={`p-2 rounded text-gray-600 hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
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
            disabled={!editor.can().chain().focus().toggleBulletList().run()}
            className={`p-2 rounded text-gray-600 hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              editor.isActive('bulletList') ? 'bg-blue-200 text-blue-900' : ''
            }`}
            title="Bullet List"
          >
            <List size={16} />
          </button>

          <button
            type="button"
            onClick={toggleOrderedList}
            disabled={!editor.can().chain().focus().toggleOrderedList().run()}
            className={`p-2 rounded text-gray-600 hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
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
            disabled={!editor.can().chain().focus().undo().run()}
            className="p-2 rounded text-gray-600 hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Undo (Ctrl+Z)"
          >
            <Undo size={16} />
          </button>

          <button
            type="button"
            onClick={redo}
            disabled={!editor.can().chain().focus().redo().run()}
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
          className="fixed-editor-content"
        />
        
        {/* Placeholder when empty */}
        {editor.isEmpty && (
          <div className="absolute top-4 left-4 text-gray-400 pointer-events-none">
            {placeholder}
          </div>
        )}
      </div>
      
      {/* Simplified styles for debugging */}
      <style jsx>{`
        .fixed-editor-content :global(.ProseMirror) {
          outline: none;
          padding: 1rem;
          min-height: ${minHeight};
        }
        
        .fixed-editor-content :global(h1) {
          font-size: 2rem;
          font-weight: 700;
          margin: 1.5rem 0 1rem 0;
          line-height: 1.2;
        }
        
        .fixed-editor-content :global(h2) {
          font-size: 1.5rem;
          font-weight: 600;
          margin: 1.25rem 0 0.75rem 0;
          line-height: 1.3;
        }
        
        .fixed-editor-content :global(p) {
          margin: 0.75rem 0;
          line-height: 1.6;
        }
        
        .fixed-editor-content :global(ul) {
          list-style-type: disc;
          margin: 1rem 0;
          padding-left: 1.5rem;
        }
        
        .fixed-editor-content :global(ol) {
          list-style-type: decimal;
          margin: 1rem 0;
          padding-left: 1.5rem;
        }
        
        .fixed-editor-content :global(li) {
          margin: 0.25rem 0;
          line-height: 1.5;
        }
        
        .fixed-editor-content :global(strong) {
          font-weight: 600;
        }
        
        .fixed-editor-content :global(em) {
          font-style: italic;
        }
        
        .fixed-editor-content :global(code) {
          background-color: #f3f4f6;
          color: #dc2626;
          padding: 0.125rem 0.25rem;
          border-radius: 0.25rem;
          font-size: 0.875em;
          font-family: monospace;
        }
      `}</style>
    </div>
  );
}
