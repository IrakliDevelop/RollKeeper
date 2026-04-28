import { describe, it, expect } from 'vitest';
import {
  convertBackgroundFeatureToExtendedFeature,
  convertFeatToExtendedFeature,
  convertClassFeatureToExtendedFeature,
  partialFeatureToFormData,
  type FeatureFormData,
} from '@/utils/featureConversion';
import type {
  ProcessedBackgroundFeature,
  ProcessedFeat,
} from '@/types/features';
import type { ClassFeature } from '@/types/classes';
import type { ExtendedFeature } from '@/types/character';

// =============================================
// Helpers
// =============================================

const makeBackgroundFeature = (
  overrides: Partial<ProcessedBackgroundFeature> = {}
): ProcessedBackgroundFeature => ({
  id: 'shelter-of-the-faithful',
  name: 'Shelter of the Faithful',
  backgroundName: 'Acolyte',
  source: 'PHB',
  description:
    'As an acolyte, you command the respect of those who share your faith.',
  isSrd: true,
  ...overrides,
});

const makeProcessedFeat = (
  overrides: Partial<ProcessedFeat> = {}
): ProcessedFeat => ({
  id: 'alert-phb',
  name: 'Alert',
  source: 'PHB',
  description:
    'Always on the lookout for danger, you gain the following benefits.',
  prerequisites: [],
  abilityIncreases: '',
  repeatable: false,
  grantsSpells: false,
  isSrd: true,
  tags: ['combat', 'alert'],
  ...overrides,
});

const makeClassFeature = (
  overrides: Partial<ClassFeature> = {}
): ClassFeature => ({
  name: 'Action Surge',
  level: 2,
  source: 'PHB',
  className: 'Fighter',
  entries: [
    'Starting at 2nd level, you can push yourself beyond your normal limits for a moment.',
  ],
  isSubclassFeature: false,
  original: 'Action Surge',
  ...overrides,
});

// =============================================
// convertBackgroundFeatureToExtendedFeature
// =============================================
describe('convertBackgroundFeatureToExtendedFeature', () => {
  it('maps name and sourceType', () => {
    const result = convertBackgroundFeatureToExtendedFeature(
      makeBackgroundFeature()
    );
    expect(result.name).toBe('Shelter of the Faithful');
    expect(result.sourceType).toBe('background');
  });

  it('sets sourceDetail to backgroundName', () => {
    const result = convertBackgroundFeatureToExtendedFeature(
      makeBackgroundFeature()
    );
    expect(result.sourceDetail).toBe('Acolyte');
  });

  it('sets category to "Background Feature"', () => {
    const result = convertBackgroundFeatureToExtendedFeature(
      makeBackgroundFeature()
    );
    expect(result.category).toBe('Background Feature');
  });

  it('sets isPassive to true when no usage pattern found', () => {
    const feature = makeBackgroundFeature({
      description: 'You know the history of your people.',
    });
    const result = convertBackgroundFeatureToExtendedFeature(feature);
    expect(result.isPassive).toBe(true);
    expect(result.maxUses).toBe(0);
  });

  it('detects short rest usage', () => {
    const feature = makeBackgroundFeature({
      description: 'Once per short rest, you can use this ability.',
    });
    const result = convertBackgroundFeatureToExtendedFeature(feature);
    expect(result.isPassive).toBe(false);
    expect(result.restType).toBe('short');
    expect(result.maxUses).toBe(1);
  });

  it('detects long rest usage', () => {
    const feature = makeBackgroundFeature({
      description: 'After a long rest, you regain use of this feature.',
    });
    const result = convertBackgroundFeatureToExtendedFeature(feature);
    expect(result.isPassive).toBe(false);
    expect(result.restType).toBe('long');
  });

  it('detects once per day usage', () => {
    const feature = makeBackgroundFeature({
      description: 'You can use this ability once per day.',
    });
    const result = convertBackgroundFeatureToExtendedFeature(feature);
    expect(result.isPassive).toBe(false);
    expect(result.restType).toBe('long');
    expect(result.maxUses).toBe(1);
  });

  it('sets scaleWithProficiency to false', () => {
    const result = convertBackgroundFeatureToExtendedFeature(
      makeBackgroundFeature()
    );
    expect(result.scaleWithProficiency).toBe(false);
  });
});

// =============================================
// convertFeatToExtendedFeature
// =============================================
describe('convertFeatToExtendedFeature', () => {
  it('maps name and sourceType', () => {
    const result = convertFeatToExtendedFeature(makeProcessedFeat());
    expect(result.name).toBe('Alert');
    expect(result.sourceType).toBe('feat');
  });

  it('sets category to "General Feat" when no spells granted', () => {
    const result = convertFeatToExtendedFeature(
      makeProcessedFeat({ grantsSpells: false })
    );
    expect(result.category).toBe('General Feat');
  });

  it('sets category to "Spellcasting Feat" when grantsSpells is true', () => {
    const result = convertFeatToExtendedFeature(
      makeProcessedFeat({ grantsSpells: true })
    );
    expect(result.category).toBe('Spellcasting Feat');
  });

  it('includes source in sourceDetail', () => {
    const result = convertFeatToExtendedFeature(
      makeProcessedFeat({ source: 'PHB' })
    );
    expect(result.sourceDetail).toContain('PHB');
  });

  it('includes prerequisites in sourceDetail', () => {
    const feat = makeProcessedFeat({ prerequisites: ['Strength 13'] });
    const result = convertFeatToExtendedFeature(feat);
    expect(result.sourceDetail).toContain('Strength 13');
  });

  it('includes abilityIncreases in sourceDetail', () => {
    const feat = makeProcessedFeat({ abilityIncreases: '+1 Strength' });
    const result = convertFeatToExtendedFeature(feat);
    expect(result.sourceDetail).toContain('+1 Strength');
  });

  it('sets isPassive true when no usage detected', () => {
    const feat = makeProcessedFeat({
      description: 'You become proficient in Athletics.',
    });
    const result = convertFeatToExtendedFeature(feat);
    expect(result.isPassive).toBe(true);
    expect(result.maxUses).toBe(0);
  });

  it('detects number of uses from description', () => {
    const feat = makeProcessedFeat({
      description: 'You can use this feature 3 times per long rest.',
    });
    const result = convertFeatToExtendedFeature(feat);
    expect(result.maxUses).toBe(3);
    expect(result.restType).toBe('long');
    expect(result.isPassive).toBe(false);
  });

  it('detects proficiency scaling', () => {
    const feat = makeProcessedFeat({
      description:
        'You can use this feature a number of times equal to your proficiency bonus per long rest.',
    });
    const result = convertFeatToExtendedFeature(feat);
    expect(result.scaleWithProficiency).toBe(true);
    expect(result.proficiencyMultiplier).toBe(1);
  });

  it('detects doubled proficiency scaling', () => {
    const feat = makeProcessedFeat({
      description:
        'You can use this feature twice your proficiency bonus times equal to per long rest.',
    });
    const result = convertFeatToExtendedFeature(feat);
    expect(result.scaleWithProficiency).toBe(true);
    expect(result.proficiencyMultiplier).toBe(2);
  });

  it('defaults to non-scaling when no proficiency bonus mention', () => {
    const result = convertFeatToExtendedFeature(makeProcessedFeat());
    expect(result.scaleWithProficiency).toBe(false);
    expect(result.proficiencyMultiplier).toBe(1);
  });
});

// =============================================
// convertClassFeatureToExtendedFeature
// =============================================
describe('convertClassFeatureToExtendedFeature', () => {
  it('maps name and sourceType', () => {
    const result = convertClassFeatureToExtendedFeature(makeClassFeature());
    expect(result.name).toBe('Action Surge');
    expect(result.sourceType).toBe('class');
  });

  it('sets category to "Class Feature" for non-subclass', () => {
    const result = convertClassFeatureToExtendedFeature(makeClassFeature());
    expect(result.category).toBe('Class Feature');
  });

  it('sets category to "Subclass Feature" for subclass feature', () => {
    const feature = makeClassFeature({
      isSubclassFeature: true,
      subclassShortName: 'Champion',
    });
    const result = convertClassFeatureToExtendedFeature(feature);
    expect(result.category).toBe('Subclass Feature');
  });

  it('builds sourceDetail with class name and level', () => {
    const result = convertClassFeatureToExtendedFeature(makeClassFeature());
    expect(result.sourceDetail).toContain('Fighter');
    expect(result.sourceDetail).toContain('2');
  });

  it('builds sourceDetail with subclass name and level for subclass', () => {
    const feature = makeClassFeature({
      isSubclassFeature: true,
      subclassShortName: 'Champion',
      level: 3,
    });
    const result = convertClassFeatureToExtendedFeature(feature);
    expect(result.sourceDetail).toContain('Champion');
    expect(result.sourceDetail).toContain('3');
  });

  it('handles empty entries array', () => {
    const feature = makeClassFeature({ entries: [] });
    const result = convertClassFeatureToExtendedFeature(feature);
    expect(result.description).toBeDefined();
  });

  it('handles undefined entries', () => {
    const feature = makeClassFeature({ entries: undefined });
    const result = convertClassFeatureToExtendedFeature(feature);
    expect(result.description).toBeDefined();
  });

  it('detects short rest recharge from entries', () => {
    const feature = makeClassFeature({
      entries: ['You regain use of this feature after a short rest.'],
    });
    const result = convertClassFeatureToExtendedFeature(feature);
    expect(result.isPassive).toBe(false);
    expect(result.restType).toBe('short');
  });

  it('detects long rest recharge from entries', () => {
    const feature = makeClassFeature({
      entries: ['You regain this ability after finishing a long rest.'],
    });
    const result = convertClassFeatureToExtendedFeature(feature);
    expect(result.isPassive).toBe(false);
    expect(result.restType).toBe('long');
  });

  it('sets isPassive true for passive features', () => {
    const feature = makeClassFeature({
      entries: ['You gain proficiency with all martial weapons.'],
    });
    const result = convertClassFeatureToExtendedFeature(feature);
    expect(result.isPassive).toBe(true);
  });
});

// =============================================
// partialFeatureToFormData
// =============================================
describe('partialFeatureToFormData', () => {
  it('converts a full partial feature to form data', () => {
    const partial: Partial<ExtendedFeature> = {
      name: 'Second Wind',
      description: 'Heal yourself.',
      sourceType: 'class',
      sourceDetail: 'Fighter Level 1',
      category: 'Class Feature',
      maxUses: 1,
      restType: 'short',
      isPassive: false,
      scaleWithProficiency: false,
      proficiencyMultiplier: 1,
    };
    const result = partialFeatureToFormData(partial);
    expect(result.name).toBe('Second Wind');
    expect(result.description).toBe('Heal yourself.');
    expect(result.sourceType).toBe('class');
    expect(result.maxUses).toBe(1);
    expect(result.restType).toBe('short');
    expect(result.isPassive).toBe(false);
  });

  it('provides defaults for missing fields', () => {
    const result = partialFeatureToFormData({});
    expect(result.name).toBe('');
    expect(result.description).toBe('');
    expect(result.sourceType).toBe('other');
    expect(result.sourceDetail).toBe('');
    expect(result.category).toBe('');
    expect(result.maxUses).toBe(0);
    expect(result.restType).toBe('long');
    expect(result.isPassive).toBe(true);
    expect(result.scaleWithProficiency).toBe(false);
    expect(result.proficiencyMultiplier).toBe(1);
  });

  it('preserves isPassive: false when explicitly set', () => {
    const result = partialFeatureToFormData({ isPassive: false });
    expect(result.isPassive).toBe(false);
  });

  it('preserves scaleWithProficiency: true when set', () => {
    const result = partialFeatureToFormData({
      scaleWithProficiency: true,
      proficiencyMultiplier: 2,
    });
    expect(result.scaleWithProficiency).toBe(true);
    expect(result.proficiencyMultiplier).toBe(2);
  });

  it('handles all sourceType values', () => {
    const types: Array<ExtendedFeature['sourceType']> = [
      'class',
      'subclass',
      'background',
      'feat',
      'racial',
      'other',
    ];
    for (const sourceType of types) {
      const result = partialFeatureToFormData({ sourceType });
      expect(result.sourceType).toBe(sourceType);
    }
  });
});
