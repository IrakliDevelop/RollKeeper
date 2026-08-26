'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowLeft, AlertTriangle, Pen } from 'lucide-react';

const FieldNotesCanvas = dynamic(
  () => import('@/prototypes/notes-module/FieldNotesCanvas'),
  {
    loading: () => (
      <div className="flex h-full items-center justify-center text-slate-500">
        Loading FieldNotes canvas...
      </div>
    ),
    ssr: false,
  }
);

export default function FieldNotesPrototypePage() {
  return (
    <div className="flex h-screen flex-col">
      {/* Prototype Banner */}
      <div className="border-b border-indigo-200 bg-indigo-50 px-6 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-indigo-800">
            <AlertTriangle size={14} />
            <span className="text-xs font-medium">
              Prototype — FieldNotes infinite canvas (custom engine)
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/prototype"
              className="flex items-center gap-1.5 rounded bg-indigo-100 px-2.5 py-1 text-xs text-indigo-800 hover:bg-indigo-200"
            >
              <ArrowLeft size={12} />
              ReactFlow Canvas
            </Link>
            <Link
              href="/prototype/tldraw"
              className="flex items-center gap-1.5 rounded bg-indigo-100 px-2.5 py-1 text-xs text-indigo-800 hover:bg-indigo-200"
            >
              <Pen size={12} />
              tldraw Canvas
            </Link>
            <Link
              href="/"
              className="flex items-center gap-1.5 rounded bg-indigo-100 px-2.5 py-1 text-xs text-indigo-800 hover:bg-indigo-200"
            >
              Back to Main
            </Link>
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1">
        <FieldNotesCanvas />
      </div>
    </div>
  );
}
