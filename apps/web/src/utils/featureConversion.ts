/**
 * Feature Conversion Utilities
 * Converts ProcessedBackgroundFeature, ProcessedFeat, and ClassFeature
 * to ExtendedFeature format for character sheet
 */

import { ExtendedFeature } from '@/types/character';
import type {
  ProcessedBackgroundFeature,
  ProcessedFeat,
} from '@/types/features';
import { ClassFeature } from '@/types/classes';
import { formatSpellDescriptionForEditor } from './referenceParser';

/**
 * Try to detect if a feature has limited uses from its description
 */
function parseUsesFromDescription(
  description: string
): { maxUses: number; restType: 'short' | 'long' } | null {
  const desc = description.toLowerCase();

  // Check for short rest recharge
  if (desc.includes('short rest') || desc.includes('short or long rest')) {
    // Try to find number of uses
    const usesMatch = desc.match(/(\d+)\s+(?:time|use)s?/i);
    if (usesMatch) {
      return {
        maxUses: parseInt(usesMatch[1]),
        restType: 'short',
      };
    }
    return {
      maxUses: 1,
      restType: 'short',
    };
  }

  // Check for long rest recharge
  if (desc.includes('long rest') || desc.includes('finish a rest')) {
    const usesMatch = desc.match(/(\d+)\s+(?:time|use)s?/i);
    if (usesMatch) {
      return {
        maxUses: parseInt(usesMatch[1]),
        restType: 'long',
      };
    }
    return {
      maxUses: 1,
      restType: 'long',
    };
  }

  // Check for once per day
  if (desc.includes('once per day') || desc.includes('once a day')) {
    return {
      maxUses: 1,
      restType: 'long',
    };
  }

  // Check for proficiency bonus times per day/rest
  if (
    desc.includes('proficiency bonus') &&
    (desc.includes('per day') || desc.includes('per long rest'))
  ) {
    return {
      maxUses: 0, // Will be calculated dynamically
      restType: 'long',
    };
  }

  return null;
}

/**
 * Detect if feature scales with proficiency bonus
 */
function detectProficiencyScaling(description: string): {
  scales: boolean;
  multiplier: number;
} {
  const desc = description.toLowerCase();

  if (
    desc.includes('proficiency bonus') &&
    (desc.includes('equal to') || desc.includes('number of times'))
  ) {
    // Check for multipliers like "twice your proficiency bonus"
    if (
      desc.includes('twice') ||
      desc.includes('two times') ||
      desc.includes('2 ×')
    ) {
      return { scales: true, multiplier: 2 };
    }

    return { scales: true, multiplier: 1 };
  }

  return { scales: false, multiplier: 1 };
}

/**
 * Convert ProcessedBackgroundFeature to Partial<ExtendedFeature>
 */
export function convertBackgroundFeatureToExtendedFeature(
  feature: ProcessedBackgroundFeature
): Partial<ExtendedFeature> {
  const formattedDescription = formatSpellDescriptionForEditor(
    feature.description
  );
  const usageInfo = parseUsesFromDescription(feature.description);

  return {
    name: feature.name,
    description: formattedDescription,
    sourceType: 'background',
    sourceDetail: feature.backgroundName,
    category: 'Background Feature',
    maxUses: usageInfo?.maxUses || 0,
    restType: usageInfo?.restType || 'long',
    isPassive: !usageInfo, // If no usage info detected, assume passive
    scaleWithProficiency: false,
    proficiencyMultiplier: 1,
  };
}

/**
 * Convert ProcessedFeat to Partial<ExtendedFeature>
 */
export function convertFeatToExtendedFeature(
  feat: ProcessedFeat
): Partial<ExtendedFeature> {
  const formattedDescription = formatSpellDescriptionForEditor(
    feat.description
  );
  const usageInfo = parseUsesFromDescription(feat.description);
  const scalingInfo = detectProficiencyScaling(feat.description);

  // Build source detail string
  let sourceDetail = feat.source;
  if (feat.prerequisites.length > 0) {
    sourceDetail += ` (Requires: ${feat.prerequisites.join(', ')})`;
  }
  if (feat.abilityIncreases) {
    sourceDetail += ` [${feat.abilityIncreases}]`;
  }

  return {
    name: feat.name,
    description: formattedDescription,
    sourceType: 'feat',
    sourceDetail,
    category: feat.grantsSpells ? 'Spellcasting Feat' : 'General Feat',
    maxUses: usageInfo?.maxUses || 0,
    restType: usageInfo?.restType || 'long',
    isPassive: !usageInfo,
    scaleWithProficiency: scalingInfo.scales,
    proficiencyMultiplier: scalingInfo.multiplier,
  };
}

/**
 * Convert ClassFeature to Partial<ExtendedFeature>
 */
export function convertClassFeatureToExtendedFeature(
  feature: ClassFeature
): Partial<ExtendedFeature> {
  const description = feature.entries?.join('\n\n') || '';
  const formattedDescription = formatSpellDescriptionForEditor(description);
  const usageInfo = parseUsesFromDescription(description);
  const scalingInfo = detectProficiencyScaling(description);

  // Build source detail
  const sourceDetail =
    feature.isSubclassFeature && feature.subclassShortName
      ? `${feature.subclassShortName} Level ${feature.level}`
      : `${feature.className} Level ${feature.level}`;

  return {
    name: feature.name,
    description: formattedDescription,
    sourceType: 'class',
    sourceDetail,
    category: feature.isSubclassFeature ? 'Subclass Feature' : 'Class Feature',
    maxUses: usageInfo?.maxUses || 0,
    restType: usageInfo?.restType || 'long',
    isPassive: !usageInfo,
    scaleWithProficiency: scalingInfo.scales,
    proficiencyMultiplier: scalingInfo.multiplier,
  };
}

/**
 * Create form data for feature from autocomplete selection
 */
export interface FeatureFormData {
  name: string;
  description: string;
  sourceType: ExtendedFeature['sourceType'];
  sourceDetail: string;
  category: string;
  maxUses: number;
  restType: 'short' | 'long';
  isPassive: boolean;
  scaleWithProficiency: boolean;
  proficiencyMultiplier: number;
}

/**
 * Convert partial extended feature to form data
 */
export function partialFeatureToFormData(
  partial: Partial<ExtendedFeature>
): FeatureFormData {
  return {
    name: partial.name || '',
    description: partial.description || '',
    sourceType: partial.sourceType || 'other',
    sourceDetail: partial.sourceDetail || '',
    category: partial.category || '',
    maxUses: partial.maxUses || 0,
    restType: partial.restType || 'long',
    isPassive: partial.isPassive ?? true,
    scaleWithProficiency: partial.scaleWithProficiency ?? false,
    proficiencyMultiplier: partial.proficiencyMultiplier || 1,
  };
}
