/**
 * Hook for loading and managing all feature sources
 * Aggregates backgrounds, feats, and class features
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useBackgroundsData } from './useBackgroundsData';
import { useFeatsData } from './useFeatsData';
import { CharacterState } from '@/types/character';
import type { ProcessedClass } from '@/types/classes';
import {
  FeatureAutocompleteItem,
  backgroundFeatureToAutocompleteItem,
  featToAutocompleteItem,
  classFeatureToAutocompleteItem,
  FeatureSourceFilter,
} from '@/types/features';

interface UseFeatureSourcesDataReturn {
  allFeatures: FeatureAutocompleteItem[];
  loading: boolean;
  error: Error | null;
  filterBySourceType: (
    sourceType: FeatureSourceFilter
  ) => FeatureAutocompleteItem[];
  filterByClass: (className: string) => FeatureAutocompleteItem[];
  filterBySubclass: (
    className: string,
    subclassName: string
  ) => FeatureAutocompleteItem[];
  searchFeatures: (
    query: string,
    sourceType?: FeatureSourceFilter
  ) => FeatureAutocompleteItem[];
}

/**
 * Hook to load and manage all feature sources
 */
export function useFeatureSourcesData(
  character?: CharacterState
): UseFeatureSourcesDataReturn {
  const {
    features: backgroundFeatures,
    loading: backgroundsLoading,
    error: backgroundsError,
  } = useBackgroundsData();
  const { feats, loading: featsLoading, error: featsError } = useFeatsData();
  const [classes, setClasses] = useState<ProcessedClass[]>([]);
  const [classesLoading, setClassesLoading] = useState(true);
  const [classesError, setClassesError] = useState<Error | null>(null);

  // Load class data on mount
  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      try {
        setClassesLoading(true);
        setClassesError(null);

        const response = await fetch('/api/classes');
        if (!response.ok) {
          throw new Error(`Failed to fetch classes: ${response.statusText}`);
        }

        const data = await response.json();

        if (mounted) {
          setClasses(data.classes || []);
          setClassesLoading(false);
        }
      } catch (err) {
        console.error('Error loading classes:', err);
        if (mounted) {
          setClassesError(
            err instanceof Error ? err : new Error('Failed to load classes')
          );
          setClassesLoading(false);
        }
      }
    };

    loadData();

    return () => {
      mounted = false;
    };
  }, []);

  // Combine loading and error states
  const loading = backgroundsLoading || featsLoading || classesLoading;
  const error = backgroundsError || featsError || classesError;

  // Convert all sources to unified autocomplete items
  const allFeatures = useMemo(() => {
    const items: FeatureAutocompleteItem[] = [];

    // Add background features
    backgroundFeatures.forEach(feature => {
      items.push(backgroundFeatureToAutocompleteItem(feature));
    });

    // Add feats
    feats.forEach(feat => {
      items.push(featToAutocompleteItem(feat));
    });

    // Add class features from all classes
    // Note: We load ALL class/subclass features and let the user select via dropdown
    classes.forEach(classData => {
      // Add main class features
      classData.features.forEach(feature => {
        // If character data available, only show features up to their level
        if (!character || feature.level <= character.level) {
          items.push(classFeatureToAutocompleteItem(feature));
        }
      });

      // Add all subclass features (user will select via dropdown)
      classData.subclasses?.forEach(subclass => {
        subclass.features.forEach(feature => {
          // If character data available, only show features up to their level
          if (!character || feature.level <= character.level) {
            items.push(classFeatureToAutocompleteItem(feature));
          }
        });
      });
    });

    return items;
  }, [backgroundFeatures, feats, classes, character]);

  // Filter by source type
  const filterBySourceType = useCallback(
    (sourceType: FeatureSourceFilter): FeatureAutocompleteItem[] => {
      if (sourceType === 'all') return allFeatures;
      return allFeatures.filter(f => f.sourceType === sourceType);
    },
    [allFeatures]
  );

  // Filter by class name
  const filterByClass = useCallback(
    (className: string): FeatureAutocompleteItem[] => {
      return allFeatures.filter(
        f =>
          f.sourceType === 'class' &&
          f.metadata.className?.toLowerCase() === className.toLowerCase() &&
          !f.metadata.isSubclassFeature
      );
    },
    [allFeatures]
  );

  // Filter by subclass (className and subclass name/short name)
  const filterBySubclass = useCallback(
    (className: string, subclassName?: string): FeatureAutocompleteItem[] => {
      return allFeatures.filter(f => {
        if (f.sourceType !== 'subclass') return false;
        if (f.metadata.className?.toLowerCase() !== className.toLowerCase())
          return false;

        // If no subclass name provided, return all subclasses for this class
        if (!subclassName) return true;

        // Filter by specific subclass
        return (
          f.metadata.subclassShortName
            ?.toLowerCase()
            .includes(subclassName.toLowerCase()) ||
          f.name.toLowerCase().includes(subclassName.toLowerCase())
        );
      });
    },
    [allFeatures]
  );

  // Search features with optional source type filter
  const searchFeatures = useCallback(
    (
      query: string,
      sourceType?: FeatureSourceFilter
    ): FeatureAutocompleteItem[] => {
      const features =
        sourceType && sourceType !== 'all'
          ? filterBySourceType(sourceType)
          : allFeatures;

      if (!query.trim()) return features;

      const queryLower = query.toLowerCase().trim();

      return features.filter(
        f =>
          f.name.toLowerCase().includes(queryLower) ||
          f.description.toLowerCase().includes(queryLower) ||
          f.tags.some(t => t.toLowerCase().includes(queryLower)) ||
          f.metadata.backgroundName?.toLowerCase().includes(queryLower) ||
          f.metadata.className?.toLowerCase().includes(queryLower)
      );
    },
    [allFeatures, filterBySourceType]
  );

  return {
    allFeatures,
    loading,
    error,
    filterBySourceType,
    filterByClass,
    filterBySubclass,
    searchFeatures,
  };
}
