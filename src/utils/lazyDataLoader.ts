/**
 * Lazy data loading utilities for D&D content
 * This helps reduce initial bundle size by loading data only when needed
 */

import { ProcessedMonster } from '@/types/bestiary';
import { ProcessedSpell } from '@/types/spells';
import { ProcessedClass } from '@/types/classes';
import {
  fetchBestiary,
  fetchSpells,
  fetchClasses,
  fetchPopularMonsters,
} from '@/utils/apiClient';

// Cache for lazy-loaded data
let bestiaryCache: ProcessedMonster[] | null = null;
let spellsCache: ProcessedSpell[] | null = null;
let classesCache: ProcessedClass[] | null = null;

/**
 * Lazy load bestiary data with caching
 * Only loads when first requested, then caches for subsequent calls
 */
export async function lazyLoadBestiary(): Promise<ProcessedMonster[]> {
  if (bestiaryCache) {
    return bestiaryCache;
  }

  try {
    console.log('Lazy loading bestiary data...');
    const startTime = performance.now();

    // Use API client for cleaner error handling
    const monsters = await fetchBestiary();

    bestiaryCache = monsters;

    const loadTime = performance.now() - startTime;
    console.log(
      `Bestiary loaded: ${monsters.length} monsters in ${loadTime.toFixed(2)}ms`
    );

    return monsters;
  } catch (error) {
    console.error('Failed to lazy load bestiary:', error);
    return [];
  }
}

/**
 * Lazy load spells data with caching
 */
export async function lazyLoadSpells(): Promise<ProcessedSpell[]> {
  if (spellsCache) {
    return spellsCache;
  }

  try {
    console.log('Lazy loading spells data...');
    const startTime = performance.now();

    // Use API client for cleaner error handling
    const spells = await fetchSpells();

    spellsCache = spells;

    const loadTime = performance.now() - startTime;
    console.log(
      `Spells loaded: ${spells.length} spells in ${loadTime.toFixed(2)}ms`
    );

    return spells;
  } catch (error) {
    console.error('Failed to lazy load spells:', error);
    return [];
  }
}

/**
 * Lazy load classes data with caching
 */
export async function lazyLoadClasses(): Promise<ProcessedClass[]> {
  if (classesCache) {
    return classesCache;
  }

  try {
    console.log('Lazy loading classes data...');
    const startTime = performance.now();

    // Use API client for cleaner error handling
    const classes = await fetchClasses();

    classesCache = classes;

    const loadTime = performance.now() - startTime;
    console.log(
      `Classes loaded: ${classes.length} classes in ${loadTime.toFixed(2)}ms`
    );

    return classes;
  } catch (error) {
    console.error('Failed to lazy load classes:', error);
    return [];
  }
}

/**
 * Preload popular monsters for instant access
 * This loads a subset of commonly used monsters
 */
export async function preloadPopularMonsters(): Promise<ProcessedMonster[]> {
  try {
    // Use the API client's popular monsters function
    const popularMonsters = await fetchPopularMonsters();

    console.log(`Preloaded ${popularMonsters.length} popular monsters`);
    return popularMonsters;
  } catch (error) {
    console.error('Failed to preload popular monsters:', error);
    return [];
  }
}

/**
 * Get data loading statistics
 */
export function getDataLoadingStats() {
  return {
    bestiaryLoaded: bestiaryCache !== null,
    bestiaryCount: bestiaryCache?.length || 0,
    spellsLoaded: spellsCache !== null,
    spellsCount: spellsCache?.length || 0,
    classesLoaded: classesCache !== null,
    classesCount: classesCache?.length || 0,
  };
}

/**
 * Clear all caches (useful for development/testing)
 */
export function clearDataCaches() {
  bestiaryCache = null;
  spellsCache = null;
  classesCache = null;
  console.log('All data caches cleared');
}
