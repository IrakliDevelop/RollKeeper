'use client';

import React from 'react';
import { useProtoNotesStore } from './notesStore';
import { 
  Plus, 
  FileText,
  Download
} from 'lucide-react';

interface NotesCanvasFallbackProps {
  onEditNote?: (noteId: string) => void;
}

export default function NotesCanvasFallback({ }: NotesCanvasFallbackProps) {
  const { notes, createNote, updateNotePosition } = useProtoNotesStore();

  // Add new note to canvas
  const handleAddNote = () => {
    const id = createNote({
      title: 'New Canvas Note',
      content: '<p>Created on canvas...</p>',
      category: 'session',
      tags: [],
      isPinned: false,
    });

    // Position new note randomly
    updateNotePosition(id, { 
      x: Math.random() * 300 + 100, 
      y: Math.random() * 200 + 100 
    });
  };

  const handleInstallReactFlow = () => {
    alert('To enable the canvas view, please run: npm install reactflow');
  };

  return (
    <div className="h-full w-full bg-gray-50 flex flex-col items-center justify-center">
      <div className="text-center max-w-md p-8">
        <FileText size={64} className="mx-auto mb-6 text-gray-400" />
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Canvas View Not Available</h2>
        <p className="text-gray-600 mb-6">
          The canvas view requires React Flow to be installed. This allows you to arrange notes
          visually in a 2D space and create connections between them.
        </p>
        
        <div className="space-y-4">
          <button
            onClick={handleInstallReactFlow}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 mx-auto"
          >
            <Download size={16} />
            Install React Flow
          </button>
          
          <div className="text-sm text-gray-500">
            Run: <code className="bg-gray-100 px-2 py-1 rounded text-xs">npm install reactflow</code>
          </div>
        </div>

        <div className="mt-8 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-semibold text-blue-900 mb-2">Canvas Features</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Drag and drop notes in 2D space</li>
            <li>• Visual connections between related notes</li>
            <li>• Zoom and pan for large collections</li>
            <li>• Minimap for navigation</li>
            <li>• Save different canvas layouts</li>
          </ul>
        </div>

        <div className="mt-6 text-sm text-gray-600">
          Notes with canvas positions: {notes.filter(n => n.position).length}
        </div>
      </div>
    </div>
  );
}
