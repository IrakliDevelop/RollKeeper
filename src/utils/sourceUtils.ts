/**
 * Utilities for handling D&D source prioritization and display
 * 
 * This handles the transition from D&D 5e (2014) to D&D 5e (2024) by:
 * - Prioritizing 2024 versions (XPHB) over 2014 versions (PHB)
 * - Converting XPHB source to "PHB2024" for display
 * - Providing consistent deduplication logic across content types
 */

/**
 * Convert raw source to display source
 * XPHB (2024 Player's Handbook) -> PHB2024 for user-friendly display
 */
export function formatSourceForDisplay(rawSource: string): string {
  return rawSource === 'XPHB' ? 'PHB2024' : rawSource;
}

/**
 * Check if a source should be prioritized over another
 * Priority order: PHB2024 (XPHB) > SRD > PHB > others
 */
export function shouldReplaceSource(
  existingSource: string,
  newSource: string,
  existingIsSrd: boolean = false,
  newIsSrd: boolean = false
): boolean {
  // Always prefer 2024 version
  if (newSource === 'PHB2024') return true;
  
  // Don't replace 2024 version with anything else
  if (existingSource === 'PHB2024') return false;
  
  // Prefer SRD if no 2024 version exists
  if (!existingIsSrd && newIsSrd) return true;
  
  // Don't replace SRD with non-SRD (unless it's 2024)
  if (existingIsSrd && !newIsSrd) return false;
  
  // Prefer PHB over other sources if no 2024/SRD exists
  if (existingSource !== 'PHB' && !existingIsSrd && newSource === 'PHB') return true;
  
  return false;
}

/**
 * Generic deduplication function for D&D content with source prioritization
 * Can be used for spells, classes, feats, monsters, etc.
 */
export function deduplicateBySourcePriority<T extends { 
  name: string; 
  source: string; 
  isSrd?: boolean; 
}>(
  items: T[],
  getKey: (item: T) => string = (item) => item.name.toLowerCase()
): T[] {
  const uniqueItems = new Map<string, T>();
  
  for (const item of items) {
    const key = getKey(item);
    const existingItem = uniqueItems.get(key);
    
    if (!existingItem) {
      // No existing item, add this one
      uniqueItems.set(key, item);
    } else {
      // Check if we should replace the existing item
      const shouldReplace = shouldReplaceSource(
        existingItem.source,
        item.source,
        existingItem.isSrd || false,
        item.isSrd || false
      );
      
      if (shouldReplace) {
        uniqueItems.set(key, item);
      }
    }
  }
  
  return Array.from(uniqueItems.values());
}

/**
 * Get the edition year from a source
 * Useful for displaying edition information to users
 */
export function getSourceEdition(source: string): string {
  switch (source) {
    case 'PHB2024':
    case 'XPHB':
      return '2024';
    case 'PHB':
      return '2014';
    case 'SRD':
      return 'SRD';
    default:
      return 'Other';
  }
}

/**
 * Check if a source is from the 2024 edition
 */
export function is2024Source(source: string): boolean {
  return source === 'XPHB' || source === 'PHB2024';
}

/**
 * Check if a source is from the 2014 edition
 */
export function is2014Source(source: string): boolean {
  return source === 'PHB';
}

/**
 * Compare two sources for sorting priority
 * Returns negative if first should come before second, positive if after, 0 if equal priority
 * Priority: PHB2024 > SRD > PHB > others (alphabetical)
 */
export function compareSourcePriority(sourceA: string, sourceB: string): number {
  // PHB2024 always comes first
  if (sourceA === 'PHB2024' && sourceB !== 'PHB2024') return -1;
  if (sourceB === 'PHB2024' && sourceA !== 'PHB2024') return 1;
  
  // If both or neither are PHB2024, check SRD
  if (sourceA === 'SRD' && sourceB !== 'SRD' && sourceB !== 'PHB2024') return -1;
  if (sourceB === 'SRD' && sourceA !== 'SRD' && sourceA !== 'PHB2024') return 1;
  
  // If both or neither are SRD/PHB2024, check PHB
  if (sourceA === 'PHB' && sourceB !== 'PHB' && sourceB !== 'SRD' && sourceB !== 'PHB2024') return -1;
  if (sourceB === 'PHB' && sourceA !== 'PHB' && sourceA !== 'SRD' && sourceA !== 'PHB2024') return 1;
  
  // Equal priority, sort alphabetically
  return sourceA.localeCompare(sourceB);
} 