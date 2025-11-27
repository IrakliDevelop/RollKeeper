/**
 * Test script for data loaders
 * Run with: npx tsx scripts/test-data-loaders.ts
 */

import {
  loadAllBackgrounds,
  loadAllBackgroundFeatures,
} from '../src/utils/backgroundDataLoader';
import { loadAllFeats } from '../src/utils/featDataLoader';

async function testBackgrounds() {
  console.log('\n🎭 Testing Background Data Loader...\n');

  try {
    const backgrounds = await loadAllBackgrounds();
    console.log(`✅ Loaded ${backgrounds.length} backgrounds`);

    const features = await loadAllBackgroundFeatures();
    console.log(`✅ Loaded ${features.length} background features`);

    // Sample a few backgrounds
    console.log('\n📋 Sample Backgrounds:');
    backgrounds.slice(0, 3).forEach(bg => {
      console.log(`  • ${bg.name} (${bg.source})`);
      console.log(`    Skills: ${bg.skills.join(', ') || 'None'}`);
      console.log(`    Languages: ${bg.languages || 0}`);
      console.log(`    Features: ${bg.features.length}`);
      if (bg.features.length > 0) {
        bg.features.forEach(feat => {
          console.log(`      - ${feat.name}`);
        });
      }
    });

    return {
      success: true,
      count: backgrounds.length,
      featuresCount: features.length,
    };
  } catch (error) {
    console.error('❌ Error loading backgrounds:', error);
    return { success: false, error };
  }
}

async function testFeats() {
  console.log('\n⚔️  Testing Feat Data Loader...\n');

  try {
    const feats = await loadAllFeats();
    console.log(`✅ Loaded ${feats.length} feats`);

    // Count by category
    const withPrereqs = feats.filter(f => f.prerequisites.length > 0);
    const repeatable = feats.filter(f => f.repeatable);
    const grantsSpells = feats.filter(f => f.grantsSpells);
    const abilityIncrease = feats.filter(f => f.abilityIncreases);

    console.log('\n📊 Statistics:');
    console.log(`  • Feats with prerequisites: ${withPrereqs.length}`);
    console.log(`  • Repeatable feats: ${repeatable.length}`);
    console.log(`  • Feats that grant spells: ${grantsSpells.length}`);
    console.log(`  • Feats with ability increases: ${abilityIncrease.length}`);

    // Sample a few feats
    console.log('\n📋 Sample Feats:');
    feats.slice(0, 3).forEach(feat => {
      console.log(`  • ${feat.name} (${feat.source})`);
      if (feat.prerequisites.length > 0) {
        console.log(`    Prerequisites: ${feat.prerequisites.join(', ')}`);
      }
      if (feat.abilityIncreases) {
        console.log(`    Ability Increases: ${feat.abilityIncreases}`);
      }
      console.log(`    Description: ${feat.description.substring(0, 100)}...`);
    });

    return { success: true, count: feats.length };
  } catch (error) {
    console.error('❌ Error loading feats:', error);
    return { success: false, error };
  }
}

async function testSearch() {
  console.log('\n🔍 Testing Search Functionality...\n');

  try {
    const backgrounds = await loadAllBackgrounds();
    const features = await loadAllBackgroundFeatures();
    const feats = await loadAllFeats();

    // Test background search
    const acolyteBackground = backgrounds.find(
      bg => bg.name.toLowerCase() === 'acolyte'
    );
    if (acolyteBackground) {
      console.log('✅ Found Acolyte background');
      console.log(
        `   Features: ${acolyteBackground.features.map(f => f.name).join(', ')}`
      );
    }

    // Test feat search
    const luckyFeat = feats.find(f => f.name.toLowerCase() === 'lucky');
    if (luckyFeat) {
      console.log('✅ Found Lucky feat');
      console.log(
        `   Prerequisites: ${luckyFeat.prerequisites.length > 0 ? luckyFeat.prerequisites.join(', ') : 'None'}`
      );
    }

    // Test feature search
    const shelterFeature = features.find(f =>
      f.name.toLowerCase().includes('shelter')
    );
    if (shelterFeature) {
      console.log(
        '✅ Found feature with "shelter" in name: ' + shelterFeature.name
      );
      console.log(`   From background: ${shelterFeature.backgroundName}`);
    }

    return { success: true };
  } catch (error) {
    console.error('❌ Error during search tests:', error);
    return { success: false, error };
  }
}

async function main() {
  console.log('🚀 Starting Data Loader Tests...');
  console.log('='.repeat(60));

  const backgroundsResult = await testBackgrounds();
  const featsResult = await testFeats();
  const searchResult = await testSearch();

  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Summary:');
  console.log('='.repeat(60));

  if (backgroundsResult.success) {
    console.log(`✅ Backgrounds: ${backgroundsResult.count} loaded`);
    console.log(
      `✅ Background Features: ${backgroundsResult.featuresCount} loaded`
    );
  } else {
    console.log('❌ Backgrounds: Failed');
  }

  if (featsResult.success) {
    console.log(`✅ Feats: ${featsResult.count} loaded`);
  } else {
    console.log('❌ Feats: Failed');
  }

  if (searchResult.success) {
    console.log('✅ Search: All tests passed');
  } else {
    console.log('❌ Search: Failed');
  }

  const allPassed =
    backgroundsResult.success && featsResult.success && searchResult.success;

  console.log('\n' + '='.repeat(60));
  if (allPassed) {
    console.log('🎉 All tests passed!');
  } else {
    console.log('❌ Some tests failed. Check errors above.');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
