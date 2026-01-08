'use client';

import React from 'react';

interface RichTextRendererProps {
  content: string;
  className?: string;
}

/**
 * RichTextRenderer - Displays rich text content with the same styling as RichTextEditor
 * Use this component to display HTML content from the RichTextEditor in read-only mode
 */
export default function RichTextRenderer({
  content,
  className = '',
}: RichTextRendererProps) {
  if (!content || content.trim() === '') {
    return (
      <div className={`text-gray-500 italic ${className}`}>
        No content available...
      </div>
    );
  }

  return (
    <div className={`rich-text-renderer ${className}`}>
      <div
        className="rich-text-content"
        dangerouslySetInnerHTML={{ __html: content }}
      />

      {/* Apply the same styles as RichTextEditor for consistency */}
      <style jsx global>{`
        .rich-text-renderer .rich-text-content {
          color: #1f2937;
          font-family:
            -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.7;
        }

        /* Headings */
        .rich-text-renderer .rich-text-content h1 {
          font-size: 2.25rem !important;
          font-weight: 800 !important;
          line-height: 1.2 !important;
          margin: 2rem 0 1rem 0 !important;
          color: #111827 !important;
          display: block !important;
        }

        .rich-text-renderer .rich-text-content h2 {
          font-size: 1.875rem !important;
          font-weight: 700 !important;
          line-height: 1.3 !important;
          margin: 1.5rem 0 0.75rem 0 !important;
          color: #111827 !important;
          display: block !important;
        }

        .rich-text-renderer .rich-text-content h3 {
          font-size: 1.5rem !important;
          font-weight: 600 !important;
          line-height: 1.4 !important;
          margin: 1.25rem 0 0.5rem 0 !important;
          color: #111827 !important;
          display: block !important;
        }

        /* Paragraphs */
        .rich-text-renderer .rich-text-content p {
          margin: 0.75rem 0 !important;
          line-height: 1.7 !important;
          display: block !important;
        }

        /* Lists */
        .rich-text-renderer .rich-text-content ul {
          list-style-type: disc !important;
          margin: 1rem 0 !important;
          padding-left: 1.5rem !important;
          display: block !important;
        }

        .rich-text-renderer .rich-text-content ol {
          list-style-type: decimal !important;
          margin: 1rem 0 !important;
          padding-left: 1.5rem !important;
          display: block !important;
        }

        .rich-text-renderer .rich-text-content li {
          margin: 0.25rem 0 !important;
          line-height: 1.6 !important;
          display: list-item !important;
          list-style-position: outside !important;
        }

        .rich-text-renderer .rich-text-content li p {
          margin: 0.25rem 0 !important;
          display: inline !important;
        }

        /* Text formatting */
        .rich-text-renderer .rich-text-content strong {
          font-weight: 700 !important;
        }

        .rich-text-renderer .rich-text-content em {
          font-style: italic !important;
        }

        .rich-text-renderer .rich-text-content s {
          text-decoration: line-through !important;
        }

        /* Code */
        .rich-text-renderer .rich-text-content code {
          background-color: #f3f4f6 !important;
          color: #dc2626 !important;
          padding: 0.25rem 0.375rem !important;
          border-radius: 0.25rem !important;
          font-size: 0.875em !important;
          font-family:
            'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'Courier New',
            monospace !important;
          border: 1px solid #e5e7eb !important;
        }

        .rich-text-renderer .rich-text-content pre {
          background: #1e1e1e !important;
          color: #fff !important;
          font-family:
            'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'Courier New',
            monospace !important;
          padding: 1rem !important;
          border-radius: 0.5rem !important;
          margin: 1rem 0 !important;
          overflow-x: auto !important;
          display: block !important;
        }

        .rich-text-renderer .rich-text-content pre code {
          color: inherit !important;
          padding: 0 !important;
          background: none !important;
          font-size: inherit !important;
          border: none !important;
        }

        /* Blockquote */
        .rich-text-renderer .rich-text-content blockquote {
          padding: 1rem !important;
          border-left: 4px solid #3b82f6 !important;
          margin: 1rem 0 !important;
          font-style: italic !important;
          color: #6b7280 !important;
          display: block !important;
          background-color: #f8fafc !important;
          border-radius: 0.5rem !important;
        }

        /* Horizontal Rule */
        .rich-text-renderer .rich-text-content hr {
          border: none !important;
          border-top: 2px solid #e5e7eb !important;
          margin: 2rem 0 !important;
          display: block !important;
          width: 100% !important;
        }

        /* First and last child margin reset */
        .rich-text-renderer .rich-text-content > *:first-child {
          margin-top: 0 !important;
        }

        .rich-text-renderer .rich-text-content > *:last-child {
          margin-bottom: 0 !important;
        }
      `}</style>
    </div>
  );
}
