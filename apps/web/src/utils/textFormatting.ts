/**
 * Utility functions for processing D&D text formatting
 */

/**
 * Process D&D text with {@...} notation and markdown-style formatting
 */
export function processDndText(text: string): string {
  if (!text) return '';

  let processedText = text;

  // Handle {@dc XX} notation - convert to "DC XX"
  processedText = processedText.replace(/\{@dc\s+(\d+)\}/g, 'DC $1');

  // Handle {@variantrule Name|Source} notation - extract just the name
  processedText = processedText.replace(
    /\{@variantrule\s+([^|}\s]+)(\|[^}]*)?\}/g,
    '$1'
  );

  // Handle {@action Name|Source} notation - extract just the name
  processedText = processedText.replace(
    /\{@action\s+([^|}\s]+)(\|[^}]*)?\}/g,
    '$1'
  );

  // Handle {@condition Name|Source} notation - extract just the name
  processedText = processedText.replace(
    /\{@condition\s+([^|}\s]+)(\|[^}]*)?\}/g,
    '$1'
  );

  // Handle {@spell Name|Source} notation - extract just the name
  processedText = processedText.replace(
    /\{@spell\s+([^|}\s]+)(\|[^}]*)?\}/g,
    '$1'
  );

  // Handle {@status Name|Source} notation - extract just the name
  processedText = processedText.replace(
    /\{@status\s+([^|}\s]+)(\|[^}]*)?\}/g,
    '$1'
  );

  // Handle {@damage XdY} notation - keep as is but remove braces
  processedText = processedText.replace(/\{@damage\s+([^}]+)\}/g, '$1');

  // Handle {@dice XdY} notation - keep as is but remove braces
  processedText = processedText.replace(/\{@dice\s+([^}]+)\}/g, '$1');

  // Handle any remaining {@...} notation by extracting the first word after @
  processedText = processedText.replace(
    /\{@\w+\s+([^|}\s]+)(\|[^}]*)?\}/g,
    '$1'
  );

  return processedText;
}

/**
 * Convert markdown-style bold text (**text**) to HTML
 */
export function markdownToHtml(text: string): string {
  if (!text) return '';

  // Convert **text** to <strong>text</strong>
  return text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

/**
 * Process D&D text with both {@...} notation and markdown formatting
 */
export function processAndFormatDndText(text: string): string {
  return markdownToHtml(processDndText(text));
}

/**
 * Create HTML content that can be safely rendered
 */
export function createSafeHtml(text: string) {
  return { __html: processAndFormatDndText(text) };
}
