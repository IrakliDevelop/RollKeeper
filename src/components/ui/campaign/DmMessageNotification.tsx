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
    <div className="contents">
      {visibleMessages.map(msg => {
        const isExpanded = expandedId === msg.id;
        const isDismissing = dismissingIds.has(msg.id);

        return (
          <div
            key={msg.id}
            className={`border-divider bg-surface-elevated text-body pointer-events-auto rounded-md border p-4 transition-opacity duration-300 ${isDismissing ? 'opacity-0' : 'opacity-100'}`}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2.5">
                <MessageSquare
                  size={14}
                  className="text-muted mt-0.5 shrink-0"
                />
                <div>
                  <p className="text-muted text-xs font-medium">
                    Message from DM
                  </p>
                  <p className="text-heading mt-0.5 text-sm font-bold">
                    {msg.title}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleDismiss(msg.id)}
                className="text-muted hover:text-heading shrink-0 rounded-sm p-1 transition-colors pointer-coarse:min-h-11 pointer-coarse:min-w-11"
                title="Dismiss"
                aria-label={`Dismiss ${msg.title} message`}
              >
                <X size={16} />
              </button>
            </div>

            {/* Expandable content */}
            {msg.content && msg.content.length > 0 && (
              <>
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => setExpandedId(isExpanded ? null : msg.id)}
                  aria-expanded={isExpanded}
                  className="text-body hover:text-heading mt-2 h-auto px-0"
                  leftIcon={
                    isExpanded ? (
                      <ChevronUp size={12} />
                    ) : (
                      <ChevronDown size={12} />
                    )
                  }
                >
                  {isExpanded ? 'Hide message' : 'Read message'}
                </Button>
                {isExpanded && (
                  <div className="bg-surface-secondary text-body mt-2 rounded-md p-3 text-sm">
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
              >
                View in notes
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
