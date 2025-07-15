'use client';

import React, { useState, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle } from '@tiptap/extension-text-style';
import { 
  Bold, 
  Italic, 
  List, 
  ListOrdered, 
  Heading1, 
  Heading2, 
  Undo, 
  Redo,
  Type
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
  placeholder = 'Start typing...',
  className = '',
  minHeight = '120px'
}: RichTextEditorProps) {
  const [isMounted, setIsMounted] = useState(false);

  // Ensure component only renders on client side
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
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
        class: `prose prose-sm max-w-none focus:outline-none px-3 py-2 text-gray-800`,
        style: `min-height: ${minHeight}`,
      },
    },
  }, []);

  // Update editor content when prop changes (e.g., from localStorage rehydration)
  // Skip during initial mount to prevent hydration mismatches
  useEffect(() => {
    if (editor && isMounted && content !== editor.getHTML()) {
      // Add a small delay to ensure hydration is complete
      const timeoutId = setTimeout(() => {
        if (editor && content !== editor.getHTML()) {
          editor.commands.setContent(content);
        }
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [editor, content, isMounted]);

  // Don't render anything on server side
  if (!isMounted || !editor) {
    return (
      <div 
        className={`border border-gray-300 rounded-md bg-gray-50 ${className}`}
        style={{ minHeight }}
      >
        <div className="flex items-center justify-center h-full text-gray-500">
          Loading editor...
        </div>
      </div>
    );
  }

  const toggleBold = () => editor.chain().focus().toggleBold().run();
  const toggleItalic = () => editor.chain().focus().toggleItalic().run();
  const toggleBulletList = () => editor.chain().focus().toggleBulletList().run();
  const toggleOrderedList = () => editor.chain().focus().toggleOrderedList().run();
  const toggleHeading1 = () => editor.chain().focus().toggleHeading({ level: 1 }).run();
  const toggleHeading2 = () => editor.chain().focus().toggleHeading({ level: 2 }).run();
  const undo = () => editor.chain().focus().undo().run();
  const redo = () => editor.chain().focus().redo().run();
  const clearFormatting = () => editor.chain().focus().clearNodes().unsetAllMarks().run();

  return (
    <div className={`border border-gray-300 rounded-md overflow-hidden bg-white ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 border-b border-gray-200 bg-gray-50">
        <button
          type="button"
          onClick={toggleBold}
          className={`p-1.5 rounded text-gray-600 hover:bg-gray-200 transition-colors ${
            editor.isActive('bold') ? 'bg-gray-200 text-gray-900' : ''
          }`}
          title="Bold"
        >
          <Bold size={16} />
        </button>
        
        <button
          type="button"
          onClick={toggleItalic}
          className={`p-1.5 rounded text-gray-600 hover:bg-gray-200 transition-colors ${
            editor.isActive('italic') ? 'bg-gray-200 text-gray-900' : ''
          }`}
          title="Italic"
        >
          <Italic size={16} />
        </button>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        <button
          type="button"
          onClick={toggleHeading1}
          className={`p-1.5 rounded text-gray-600 hover:bg-gray-200 transition-colors ${
            editor.isActive('heading', { level: 1 }) ? 'bg-gray-200 text-gray-900' : ''
          }`}
          title="Heading 1"
        >
          <Heading1 size={16} />
        </button>

        <button
          type="button"
          onClick={toggleHeading2}
          className={`p-1.5 rounded text-gray-600 hover:bg-gray-200 transition-colors ${
            editor.isActive('heading', { level: 2 }) ? 'bg-gray-200 text-gray-900' : ''
          }`}
          title="Heading 2"
        >
          <Heading2 size={16} />
        </button>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        <button
          type="button"
          onClick={toggleBulletList}
          className={`p-1.5 rounded text-gray-600 hover:bg-gray-200 transition-colors ${
            editor.isActive('bulletList') ? 'bg-gray-200 text-gray-900' : ''
          }`}
          title="Bullet List"
        >
          <List size={16} />
        </button>

        <button
          type="button"
          onClick={toggleOrderedList}
          className={`p-1.5 rounded text-gray-600 hover:bg-gray-200 transition-colors ${
            editor.isActive('orderedList') ? 'bg-gray-200 text-gray-900' : ''
          }`}
          title="Numbered List"
        >
          <ListOrdered size={16} />
        </button>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        <button
          type="button"
          onClick={clearFormatting}
          className="p-1.5 rounded text-gray-600 hover:bg-gray-200 transition-colors"
          title="Clear Formatting"
        >
          <Type size={16} />
        </button>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        <button
          type="button"
          onClick={undo}
          disabled={!editor.can().undo()}
          className="p-1.5 rounded text-gray-600 hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Undo"
        >
          <Undo size={16} />
        </button>

        <button
          type="button"
          onClick={redo}
          disabled={!editor.can().redo()}
          className="p-1.5 rounded text-gray-600 hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Redo"
        >
          <Redo size={16} />
        </button>
      </div>

      {/* Editor Container */}
      <div className="relative">
        <EditorContent 
          editor={editor} 
          className="focus-within:ring-1 focus-within:ring-blue-500"
        />
        
        {/* Placeholder when empty */}
        {editor.isEmpty && (
          <div className="absolute top-3 left-3 text-gray-400 pointer-events-none">
            {placeholder}
          </div>
        )}
      </div>
    </div>
  );
} 