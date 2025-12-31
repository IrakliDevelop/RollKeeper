/**
 * Feature Source Types
 * Unified types for all feature/trait sources (backgrounds, feats, class features)
 */

import { ClassFeature } from './classes';
import {
  ProcessedBackground,
  ProcessedBackgroundFeature,
} from '../utils/backgroundDataLoader';
import { ProcessedFeat } from '../utils/featDataLoader';

// Re-export class feature type
export type ProcessedClassFeature = ClassFeature;

// Re-export for convenience
export type { ProcessedBackground, ProcessedBackgroundFeature, ProcessedFeat };

// Union type for all feature sources
export type ProcessedFeatureSource =
  | ProcessedBackgroundFeature
  | ProcessedFeat
  | ProcessedClassFeature;

// Type guard functions
export function isBackgroundFeature(
  feature: ProcessedFeatureSource
): feature is ProcessedBackgroundFeature {
  return 'backgroundName' in feature;
}

export function isFeat(
  feature: ProcessedFeatureSource
): feature is ProcessedFeat {
  return 'prerequisites' in feature && 'repeatable' in feature;
}

export function isClassFeature(
  feature: ProcessedFeatureSource
): feature is ProcessedClassFeature {
  return 'className' in feature && 'level' in feature;
}

// Feature source type for filtering
export type FeatureSourceFilter =
  | 'class'
  | 'subclass'
  | 'background'
  | 'feat'
  | 'all';

// Feature autocomplete item (unified interface for display)
export interface FeatureAutocompleteItem {
  id: string;
  name: string;
  source: string;
  sourceType: FeatureSourceFilter;
  description: string;
  metadata: {
    // For backgrounds
    backgroundName?: string;
    skills?: string[];

    // For feats
    prerequisites?: string[];
    abilityIncreases?: string;
    repeatable?: boolean;

    // For class features
    className?: string;
    level?: number;
    isSubclassFeature?: boolean;
    subclassShortName?: string;
  };
  tags: string[];
}

/**
 * Convert ProcessedBackgroundFeature to FeatureAutocompleteItem
 */
export function backgroundFeatureToAutocompleteItem(
  feature: ProcessedBackgroundFeature
): FeatureAutocompleteItem {
  return {
    id: feature.id,
    name: feature.name,
    source: feature.source,
    sourceType: 'background',
    description: feature.description,
    metadata: {
      backgroundName: feature.backgroundName,
      skills: feature.skills,
    },
    tags: [feature.source, feature.backgroundName, 'background'],
  };
}

/**
 * Convert ProcessedFeat to FeatureAutocompleteItem
 */
export function featToAutocompleteItem(
  feat: ProcessedFeat
): FeatureAutocompleteItem {
  return {
    id: feat.id,
    name: feat.name,
    source: feat.source,
    sourceType: 'feat',
    description: feat.description,
    metadata: {
      prerequisites: feat.prerequisites,
      abilityIncreases: feat.abilityIncreases,
      repeatable: feat.repeatable,
    },
    tags: feat.tags,
  };
}

/**
 * Convert ClassFeature to FeatureAutocompleteItem
 */
export function classFeatureToAutocompleteItem(
  feature: ClassFeature
): FeatureAutocompleteItem {
  // Create a unique ID that includes source and subclass (if applicable) to avoid collisions
  const sourceKey = feature.source.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const subclassKey = feature.subclassShortName
    ? `-${feature.subclassShortName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`
    : '';

  // Use a counter or index to ensure uniqueness even within same class/level/source/subclass
  const id = `${feature.className}-${feature.name}-${feature.level}-${sourceKey}${subclassKey}-${feature.original || ''}`;

  return {
    id,
    name: feature.name,
    source: feature.source,
    sourceType: feature.isSubclassFeature ? 'subclass' : 'class',
    description: feature.entries?.join('\n\n') || '',
    metadata: {
      className: feature.className,
      level: feature.level,
      isSubclassFeature: feature.isSubclassFeature,
      subclassShortName: feature.subclassShortName,
    },
    tags: [
      feature.source,
      feature.className || '',
      feature.isSubclassFeature ? 'subclass' : 'class',
      ...(feature.subclassShortName ? [feature.subclassShortName] : []),
    ].filter(Boolean),
  };
}
