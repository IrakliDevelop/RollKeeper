import { stripTags } from '@/utils/parseEntriesToHtml';

/** Plain, compact text for condition palette previews. Full rules stay on the source record. */
export function effectSummary(description: string): string {
  return stripTags(description)
    .replace(/<[^>]*>/g, ' ')
    .replace(/[<>*]/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}
