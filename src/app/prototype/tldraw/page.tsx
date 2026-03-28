'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowLeft, AlertTriangle, Pen } from 'lucide-react';

const TldrawCanvas = dynamic(
  () => import('@/prototypes/notes-module/TldrawCanvas'),
  {
    loading: () => (
      <div className="flex h-full items-center justify-center text-gray-500">
        Loading tldraw canvas...
      </div>
    ),
    ssr: false,
  }
);

export default function TldrawPrototypePage() {
  return (
    <div className="flex h-screen flex-col">
      {/* Prototype Banner */}
      <div className="border-b border-amber-200 bg-amber-50 px-6 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-800">
            <AlertTriangle size={14} />
            <span className="text-xs font-medium">
              Prototype — tldraw freeform notes canvas (draw + note cards)
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/prototype"
              className="flex items-center gap-1.5 rounded bg-amber-100 px-2.5 py-1 text-xs text-amber-800 hover:bg-amber-200"
            >
              <ArrowLeft size={12} />
              ReactFlow Canvas
            </Link>
            <Link
              href="/prototype/fieldnotes"
              className="flex items-center gap-1.5 rounded bg-amber-100 px-2.5 py-1 text-xs text-amber-800 hover:bg-amber-200"
            >
              <Pen size={12} />
              FieldNotes Canvas
            </Link>
            <Link
              href="/"
              className="flex items-center gap-1.5 rounded bg-amber-100 px-2.5 py-1 text-xs text-amber-800 hover:bg-amber-200"
            >
              Back to Main
            </Link>
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1">
        <TldrawCanvas />
      </div>
    </div>
  );
}
