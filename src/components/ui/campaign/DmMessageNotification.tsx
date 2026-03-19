'use client';

import { useState } from 'react';
import {
  MessageSquare,
  X,
  BookOpen,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import RichTextRenderer from '@/components/ui/utils/RichTextRenderer';
import type { DmMessage } from '@/types/sharedState';

interface DmMessageNotificationProps {
  messages: DmMessage[];
  onAccept: (message: DmMessage) => void;
  onDismiss: (messageId: string) => void;
}

export function DmMessageNotification({
  messages,
  onAccept,
  onDismiss,
}: DmMessageNotificationProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dismissingIds, setDismissingIds] = useState<Set<string>>(new Set());

  if (messages.length === 0) return null;

  const visibleMessages = messages.filter(m => !dismissingIds.has(m.id));
  if (visibleMessages.length === 0) return null;

  const handleDismiss = (id: string) => {
    setDismissingIds(prev => new Set(prev).add(id));
    // Animate out, then actually dismiss
    setTimeout(() => {
      onDismiss(id);
      setDismissingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 300);
  };

  const handleAccept = (msg: DmMessage) => {
    setDismissingIds(prev => new Set(prev).add(msg.id));
    setTimeout(() => {
      onAccept(msg);
      setDismissingIds(prev => {
        const next = new Set(prev);
        next.delete(msg.id);
        return next;
      });
    }, 300);
  };

  return (
    <div className="pointer-events-none fixed top-4 right-4 z-50 flex max-h-[80vh] w-80 flex-col gap-2 overflow-y-auto sm:w-96">
      {visibleMessages.map(msg => {
        const isExpanded = expandedId === msg.id;
        const isDismissing = dismissingIds.has(msg.id);

        return (
          <div
            key={msg.id}
            className={`pointer-events-auto rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-emerald-950 shadow-xl shadow-emerald-200/40 transition-all duration-300 ${
              isDismissing
                ? 'translate-x-full opacity-0'
                : 'animate-in slide-in-from-right-full translate-x-0 opacity-100'
            }`}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 rounded-full bg-emerald-200 p-1.5 text-emerald-700">
                  <MessageSquare size={14} />
                </div>
                <div>
                  <p className="text-xs font-medium text-emerald-600">
                    Message from DM
                  </p>
                  <p className="mt-0.5 text-sm font-bold text-emerald-900">
                    {msg.title}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleDismiss(msg.id)}
                className="shrink-0 rounded p-0.5 text-emerald-400 transition-colors hover:bg-emerald-200 hover:text-emerald-700"
                title="Dismiss"
              >
                <X size={16} />
              </button>
            </div>

            {/* Expandable content */}
            {msg.content && msg.content.length > 0 && (
              <>
                <button
                  onClick={() => setExpandedId(isExpanded ? null : msg.id)}
                  className="mt-2 flex items-center gap-1 text-xs text-emerald-600 transition-colors hover:text-emerald-800"
                >
                  {isExpanded ? (
                    <ChevronUp size={12} />
                  ) : (
                    <ChevronDown size={12} />
                  )}
                  {isExpanded ? 'Hide message' : 'Read message'}
                </button>
                {isExpanded && (
                  <div className="mt-2 rounded-md bg-emerald-100 p-3 text-sm text-emerald-900">
                    <RichTextRenderer content={msg.content} />
                  </div>
                )}
              </>
            )}

            {/* Actions */}
            <div className="mt-3 flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<BookOpen size={12} />}
                onClick={() => handleAccept(msg)}
                className="border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700"
              >
                View in Notes
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
