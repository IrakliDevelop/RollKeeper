'use client';

import React from 'react';
import { richTextProseCss } from '@/components/ui/forms/richText/prose';
import { sanitizeRichText } from '@/utils/sanitizeRichText';

interface RichTextRendererProps {
  content: string;
  className?: string;
}

const RENDERER_CSS = richTextProseCss('.rk-rich-text');

/**
 * RichTextRenderer - Displays HTML from the rich-text editors read-only, with
 * the same prose styles as the editors. Renders nothing for empty content.
 * The HTML is stored and can come from another user, so it goes through
 * `sanitizeRichText` first.
 */
export default function RichTextRenderer({
  content,
  className = '',
}: RichTextRendererProps) {
  if (!content || content.trim() === '') {
    return null;
  }

  return (
    <>
      <div
        className={`rk-rich-text ${className}`}
        dangerouslySetInnerHTML={{ __html: sanitizeRichText(content) }}
      />
      <style href="rk-rich-text" precedence="rk-rich-text">
        {RENDERER_CSS}
      </style>
    </>
  );
}
