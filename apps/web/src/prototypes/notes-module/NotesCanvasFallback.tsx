'use client';

import React from 'react';
import { useProtoNotesStore } from './notesStore';
import { FileText, Download } from 'lucide-react';

interface NotesCanvasFallbackProps {
  onEditNote?: (noteId: string) => void;
}

export default function NotesCanvasFallback({}: NotesCanvasFallbackProps) {
  const { notes } = useProtoNotesStore();

  const handleInstallReactFlow = () => {
    alert('To enable the canvas view, please run: npm install reactflow');
  };

  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-gray-50">
      <div className="max-w-md p-8 text-center">
        <FileText size={64} className="mx-auto mb-6 text-gray-400" />
        <h2 className="mb-4 text-2xl font-bold text-gray-900">
          Canvas View Not Available
        </h2>
        <p className="mb-6 text-gray-600">
          The canvas view requires React Flow to be installed. This allows you
          to arrange notes visually in a 2D space and create connections between
          them.
        </p>

        <div className="space-y-4">
          <button
            onClick={handleInstallReactFlow}
            className="mx-auto flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-white hover:bg-blue-700"
          >
            <Download size={16} />
            Install React Flow
          </button>

          <div className="text-sm text-gray-500">
            Run:{' '}
            <code className="rounded bg-gray-100 px-2 py-1 text-xs">
              npm install reactflow
            </code>
          </div>
        </div>

        <div className="mt-8 rounded-lg bg-blue-50 p-4">
          <h3 className="mb-2 font-semibold text-blue-900">Canvas Features</h3>
          <ul className="space-y-1 text-sm text-blue-800">
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
