import { describe, it, expect, beforeEach } from 'vitest';
import { useCharacterStore } from '@/store/characterStore';
import { usePlayerStore } from '@/store/playerStore';
import { makeCharacter } from '@/utils/__tests__/test-utils';

function resetStore(overrides = {}) {
  useCharacterStore.setState({
    character: makeCharacter(overrides),
    hasUnsavedChanges: false,
    saveStatus: 'saved',
    lastSaved: null,
    showDeathAnimation: false,
    showLevelUpAnimation: false,
    levelUpAnimationLevel: 1,
  });
  usePlayerStore.setState({
    characters: [],
    activeCharacterId: null,
    settings: {
      enableDeathAnimation: false,
      enableLevelUpAnimation: false,
      enableCombatStartBanner: false,
    },
    lastSelectedCharacterId: null,
  });
}

const baseFeature = {
  name: 'Action Surge',
  description: 'Extra action',
  sourceType: 'class' as const,
  maxUses: 1,
  usedUses: 0,
  restType: 'short' as const,
  isPassive: false,
  displayOrder: 0,
};

const longRestFeature = {
  name: 'Second Wind',
  description: 'Regain HP',
  sourceType: 'class' as const,
  maxUses: 1,
  usedUses: 0,
  restType: 'long' as const,
  isPassive: false,
  displayOrder: 1,
};

const baseTrait = {
  name: 'Breath Weapon',
  description: 'Exhale destructive energy',
  maxUses: 1,
  usedUses: 0,
  restType: 'short' as const,
};

describe('characterStore — extended features', () => {
  beforeEach(() => resetStore());

  it('addExtendedFeature adds entry to extendedFeatures', () => {
    useCharacterStore.getState().addExtendedFeature(baseFeature);
    const { character } = useCharacterStore.getState();
    expect(character.extendedFeatures).toHaveLength(1);
    expect(character.extendedFeatures[0].name).toBe('Action Surge');
    expect(character.extendedFeatures[0].id).toBeTruthy();
    expect(character.extendedFeatures[0].createdAt).toBeTruthy();
  });

  it('addExtendedFeature also mirrors into trackableTraits', () => {
    useCharacterStore.getState().addExtendedFeature(baseFeature);
    const { character } = useCharacterStore.getState();
    expect(character.trackableTraits).toHaveLength(1);
    expect(character.trackableTraits[0].name).toBe('Action Surge');
  });

  it('addExtendedFeature sets hasUnsavedChanges', () => {
    useCharacterStore.getState().addExtendedFeature(baseFeature);
    expect(useCharacterStore.getState().hasUnsavedChanges).toBe(true);
  });

  it('updateExtendedFeature updates the feature by id', () => {
    useCharacterStore.getState().addExtendedFeature(baseFeature);
    const id = useCharacterStore.getState().character.extendedFeatures[0].id;
    useCharacterStore
      .getState()
      .updateExtendedFeature(id, { name: 'Updated Action Surge', maxUses: 2 });
    const { character } = useCharacterStore.getState();
    expect(character.extendedFeatures[0].name).toBe('Updated Action Surge');
    expect(character.extendedFeatures[0].maxUses).toBe(2);
  });

  it('updateExtendedFeature also syncs to trackableTraits', () => {
    useCharacterStore.getState().addExtendedFeature(baseFeature);
    const id = useCharacterStore.getState().character.extendedFeatures[0].id;
    useCharacterStore.getState().updateExtendedFeature(id, { maxUses: 3 });
    const { character } = useCharacterStore.getState();
    expect(character.trackableTraits[0].maxUses).toBe(3);
  });

  it('deleteExtendedFeature removes from extendedFeatures', () => {
    useCharacterStore.getState().addExtendedFeature(baseFeature);
    const id = useCharacterStore.getState().character.extendedFeatures[0].id;
    useCharacterStore.getState().deleteExtendedFeature(id);
    expect(
      useCharacterStore.getState().character.extendedFeatures
    ).toHaveLength(0);
  });

  it('deleteExtendedFeature also removes from trackableTraits', () => {
    useCharacterStore.getState().addExtendedFeature(baseFeature);
    const id = useCharacterStore.getState().character.extendedFeatures[0].id;
    useCharacterStore.getState().deleteExtendedFeature(id);
    expect(useCharacterStore.getState().character.trackableTraits).toHaveLength(
      0
    );
  });

  it('deleteExtendedFeature removes from favoriteFeatureIds', () => {
    useCharacterStore.getState().addExtendedFeature(baseFeature);
    const id = useCharacterStore.getState().character.extendedFeatures[0].id;
    useCharacterStore.getState().toggleFavoriteFeature(id);
    expect(useCharacterStore.getState().character.favoriteFeatureIds).toContain(
      id
    );
    useCharacterStore.getState().deleteExtendedFeature(id);
    expect(
      useCharacterStore.getState().character.favoriteFeatureIds
    ).not.toContain(id);
  });

  it('useExtendedFeature increments usedUses', () => {
    useCharacterStore.getState().addExtendedFeature(baseFeature);
    const id = useCharacterStore.getState().character.extendedFeatures[0].id;
    useCharacterStore.getState().useExtendedFeature(id);
    const { character } = useCharacterStore.getState();
    expect(character.extendedFeatures[0].usedUses).toBe(1);
  });

  it('useExtendedFeature does not exceed maxUses', () => {
    useCharacterStore.getState().addExtendedFeature(baseFeature);
    const id = useCharacterStore.getState().character.extendedFeatures[0].id;
    useCharacterStore.getState().useExtendedFeature(id);
    useCharacterStore.getState().useExtendedFeature(id);
    const { character } = useCharacterStore.getState();
    expect(character.extendedFeatures[0].usedUses).toBe(1);
  });

  it('useExtendedFeature also syncs usedUses to trackableTraits', () => {
    useCharacterStore.getState().addExtendedFeature(baseFeature);
    const id = useCharacterStore.getState().character.extendedFeatures[0].id;
    useCharacterStore.getState().useExtendedFeature(id);
    const { character } = useCharacterStore.getState();
    expect(character.trackableTraits[0].usedUses).toBe(1);
  });

  it('resetExtendedFeatures("short") resets short-rest features to 0 usedUses', () => {
    useCharacterStore.getState().addExtendedFeature(baseFeature);
    useCharacterStore.getState().addExtendedFeature(longRestFeature);
    const features = useCharacterStore.getState().character.extendedFeatures;
    const shortId = features[0].id;
    const longId = features[1].id;
    useCharacterStore.getState().useExtendedFeature(shortId);
    useCharacterStore.getState().useExtendedFeature(longId);
    useCharacterStore.getState().resetExtendedFeatures('short');
    const updated = useCharacterStore.getState().character.extendedFeatures;
    expect(updated.find(f => f.id === shortId)!.usedUses).toBe(0);
    // long rest feature should NOT be reset by short rest
    expect(updated.find(f => f.id === longId)!.usedUses).toBe(1);
  });

  it('resetExtendedFeatures("long") resets ALL features', () => {
    useCharacterStore.getState().addExtendedFeature(baseFeature);
    useCharacterStore.getState().addExtendedFeature(longRestFeature);
    const features = useCharacterStore.getState().character.extendedFeatures;
    features.forEach(f =>
      useCharacterStore.getState().useExtendedFeature(f.id)
    );
    useCharacterStore.getState().resetExtendedFeatures('long');
    const updated = useCharacterStore.getState().character.extendedFeatures;
    updated.forEach(f => expect(f.usedUses).toBe(0));
  });

  it('reorderExtendedFeatures (no sourceType) reorders all features', () => {
    useCharacterStore
      .getState()
      .addExtendedFeature({ ...baseFeature, name: 'Feature A' });
    useCharacterStore
      .getState()
      .addExtendedFeature({ ...baseFeature, name: 'Feature B' });
    useCharacterStore
      .getState()
      .addExtendedFeature({ ...baseFeature, name: 'Feature C' });
    // Move index 0 to index 2
    useCharacterStore.getState().reorderExtendedFeatures(0, 2);
    const { extendedFeatures } = useCharacterStore.getState().character;
    expect(extendedFeatures[0].name).toBe('Feature B');
    expect(extendedFeatures[1].name).toBe('Feature C');
    expect(extendedFeatures[2].name).toBe('Feature A');
  });

  it('reorderExtendedFeatures (with sourceType) reorders within source type only', () => {
    useCharacterStore.getState().addExtendedFeature({
      ...baseFeature,
      name: 'Class A',
      sourceType: 'class' as const,
    });
    useCharacterStore.getState().addExtendedFeature({
      ...baseFeature,
      name: 'Class B',
      sourceType: 'class' as const,
    });
    useCharacterStore.getState().addExtendedFeature({
      ...baseFeature,
      name: 'Feat A',
      sourceType: 'feat' as const,
    });
    useCharacterStore.getState().reorderExtendedFeatures(0, 1, 'class');
    const { extendedFeatures } = useCharacterStore.getState().character;
    const classFeatures = extendedFeatures.filter(
      f => f.sourceType === 'class'
    );
    expect(classFeatures[0].name).toBe('Class B');
    expect(classFeatures[1].name).toBe('Class A');
    // Feat feature should still be present
    expect(extendedFeatures.find(f => f.name === 'Feat A')).toBeTruthy();
  });

  it('toggleFavoriteFeature adds id to favoriteFeatureIds', () => {
    useCharacterStore.getState().addExtendedFeature(baseFeature);
    const id = useCharacterStore.getState().character.extendedFeatures[0].id;
    useCharacterStore.getState().toggleFavoriteFeature(id);
    expect(useCharacterStore.getState().character.favoriteFeatureIds).toContain(
      id
    );
  });

  it('toggleFavoriteFeature removes id when already favorited', () => {
    useCharacterStore.getState().addExtendedFeature(baseFeature);
    const id = useCharacterStore.getState().character.extendedFeatures[0].id;
    useCharacterStore.getState().toggleFavoriteFeature(id);
    useCharacterStore.getState().toggleFavoriteFeature(id);
    expect(
      useCharacterStore.getState().character.favoriteFeatureIds
    ).not.toContain(id);
  });
});

describe('characterStore — trackable traits', () => {
  beforeEach(() => resetStore());

  it('addTrackableTrait adds entry to trackableTraits', () => {
    useCharacterStore.getState().addTrackableTrait(baseTrait);
    const { character } = useCharacterStore.getState();
    expect(character.trackableTraits).toHaveLength(1);
    expect(character.trackableTraits[0].name).toBe('Breath Weapon');
    expect(character.trackableTraits[0].id).toBeTruthy();
  });

  it('addTrackableTrait also mirrors into extendedFeatures', () => {
    useCharacterStore.getState().addTrackableTrait(baseTrait);
    const { character } = useCharacterStore.getState();
    expect(character.extendedFeatures).toHaveLength(1);
    expect(character.extendedFeatures[0].name).toBe('Breath Weapon');
    expect(character.extendedFeatures[0].sourceType).toBe('other');
  });

  it('addTrackableTrait sets hasUnsavedChanges', () => {
    useCharacterStore.getState().addTrackableTrait(baseTrait);
    expect(useCharacterStore.getState().hasUnsavedChanges).toBe(true);
  });

  it('updateTrackableTrait updates the trait by id', () => {
    useCharacterStore.getState().addTrackableTrait(baseTrait);
    const id = useCharacterStore.getState().character.trackableTraits[0].id;
    useCharacterStore
      .getState()
      .updateTrackableTrait(id, { name: 'Updated Breath Weapon', maxUses: 2 });
    const { character } = useCharacterStore.getState();
    expect(character.trackableTraits[0].name).toBe('Updated Breath Weapon');
    expect(character.trackableTraits[0].maxUses).toBe(2);
  });

  it('updateTrackableTrait also syncs to extendedFeatures', () => {
    useCharacterStore.getState().addTrackableTrait(baseTrait);
    const id = useCharacterStore.getState().character.trackableTraits[0].id;
    useCharacterStore.getState().updateTrackableTrait(id, { maxUses: 3 });
    const { character } = useCharacterStore.getState();
    expect(character.extendedFeatures[0].maxUses).toBe(3);
  });

  it('deleteTrackableTrait removes from trackableTraits', () => {
    useCharacterStore.getState().addTrackableTrait(baseTrait);
    const id = useCharacterStore.getState().character.trackableTraits[0].id;
    useCharacterStore.getState().deleteTrackableTrait(id);
    expect(useCharacterStore.getState().character.trackableTraits).toHaveLength(
      0
    );
  });

  it('deleteTrackableTrait also removes from extendedFeatures', () => {
    useCharacterStore.getState().addTrackableTrait(baseTrait);
    const id = useCharacterStore.getState().character.trackableTraits[0].id;
    useCharacterStore.getState().deleteTrackableTrait(id);
    expect(
      useCharacterStore.getState().character.extendedFeatures
    ).toHaveLength(0);
  });

  it('useTrackableTrait increments usedUses', () => {
    useCharacterStore.getState().addTrackableTrait(baseTrait);
    const id = useCharacterStore.getState().character.trackableTraits[0].id;
    useCharacterStore.getState().useTrackableTrait(id);
    expect(
      useCharacterStore.getState().character.trackableTraits[0].usedUses
    ).toBe(1);
  });

  it('useTrackableTrait does not exceed maxUses', () => {
    useCharacterStore.getState().addTrackableTrait(baseTrait);
    const id = useCharacterStore.getState().character.trackableTraits[0].id;
    useCharacterStore.getState().useTrackableTrait(id);
    useCharacterStore.getState().useTrackableTrait(id);
    expect(
      useCharacterStore.getState().character.trackableTraits[0].usedUses
    ).toBe(1);
  });

  it('useTrackableTrait also syncs to extendedFeatures', () => {
    useCharacterStore.getState().addTrackableTrait(baseTrait);
    const id = useCharacterStore.getState().character.trackableTraits[0].id;
    useCharacterStore.getState().useTrackableTrait(id);
    expect(
      useCharacterStore.getState().character.extendedFeatures[0].usedUses
    ).toBe(1);
  });

  it('resetTrackableTraits("short") resets short-rest traits', () => {
    const longTrait = {
      ...baseTrait,
      name: 'Long Rest Trait',
      restType: 'long' as const,
    };
    useCharacterStore.getState().addTrackableTrait(baseTrait);
    useCharacterStore.getState().addTrackableTrait(longTrait);
    const traits = useCharacterStore.getState().character.trackableTraits;
    const shortId = traits[0].id;
    const longId = traits[1].id;
    useCharacterStore.getState().useTrackableTrait(shortId);
    useCharacterStore.getState().useTrackableTrait(longId);
    useCharacterStore.getState().resetTrackableTraits('short');
    const updated = useCharacterStore.getState().character.trackableTraits;
    expect(updated.find(t => t.id === shortId)!.usedUses).toBe(0);
    expect(updated.find(t => t.id === longId)!.usedUses).toBe(1);
  });

  it('resetTrackableTraits("long") resets all traits', () => {
    const longTrait = {
      ...baseTrait,
      name: 'Long Rest Trait',
      restType: 'long' as const,
    };
    useCharacterStore.getState().addTrackableTrait(baseTrait);
    useCharacterStore.getState().addTrackableTrait(longTrait);
    const traits = useCharacterStore.getState().character.trackableTraits;
    traits.forEach(t => useCharacterStore.getState().useTrackableTrait(t.id));
    useCharacterStore.getState().resetTrackableTraits('long');
    const updated = useCharacterStore.getState().character.trackableTraits;
    updated.forEach(t => expect(t.usedUses).toBe(0));
  });
});

describe('characterStore — features (rich text)', () => {
  beforeEach(() => resetStore());

  const featureEntry = {
    title: 'Darkvision',
    content: '<p>See in darkness 60 ft.</p>',
    category: 'feature' as const,
  };

  it('addFeature appends to features array', () => {
    useCharacterStore.getState().addFeature(featureEntry);
    const { character } = useCharacterStore.getState();
    expect(character.features).toHaveLength(1);
    expect(character.features[0].title).toBe('Darkvision');
    expect(character.features[0].id).toBeTruthy();
  });

  it('addFeature sets hasUnsavedChanges', () => {
    useCharacterStore.getState().addFeature(featureEntry);
    expect(useCharacterStore.getState().hasUnsavedChanges).toBe(true);
  });

  it('updateFeature modifies the feature by id', () => {
    useCharacterStore.getState().addFeature(featureEntry);
    const id = useCharacterStore.getState().character.features[0].id;
    useCharacterStore
      .getState()
      .updateFeature(id, { title: 'Superior Darkvision' });
    expect(useCharacterStore.getState().character.features[0].title).toBe(
      'Superior Darkvision'
    );
  });

  it('deleteFeature removes the feature by id', () => {
    useCharacterStore.getState().addFeature(featureEntry);
    const id = useCharacterStore.getState().character.features[0].id;
    useCharacterStore.getState().deleteFeature(id);
    expect(useCharacterStore.getState().character.features).toHaveLength(0);
  });

  it('deleteFeature does not affect other features', () => {
    useCharacterStore.getState().addFeature(featureEntry);
    useCharacterStore
      .getState()
      .addFeature({ ...featureEntry, title: 'Stone Cunning' });
    const firstId = useCharacterStore.getState().character.features[0].id;
    useCharacterStore.getState().deleteFeature(firstId);
    const { features } = useCharacterStore.getState().character;
    expect(features).toHaveLength(1);
    expect(features[0].title).toBe('Stone Cunning');
  });
});

describe('characterStore — traits (rich text)', () => {
  beforeEach(() => resetStore());

  const traitEntry = {
    title: 'Brave',
    content: '<p>Advantage on saves against fear.</p>',
    category: 'trait' as const,
  };

  it('addTrait appends to traits array', () => {
    useCharacterStore.getState().addTrait(traitEntry);
    const { character } = useCharacterStore.getState();
    expect(character.traits).toHaveLength(1);
    expect(character.traits[0].title).toBe('Brave');
    expect(character.traits[0].id).toBeTruthy();
  });

  it('addTrait sets hasUnsavedChanges', () => {
    useCharacterStore.getState().addTrait(traitEntry);
    expect(useCharacterStore.getState().hasUnsavedChanges).toBe(true);
  });

  it('updateTrait modifies the trait by id', () => {
    useCharacterStore.getState().addTrait(traitEntry);
    const id = useCharacterStore.getState().character.traits[0].id;
    useCharacterStore.getState().updateTrait(id, {
      title: 'Fearless',
      content: '<p>Immune to fear.</p>',
    });
    const { traits } = useCharacterStore.getState().character;
    expect(traits[0].title).toBe('Fearless');
    expect(traits[0].content).toBe('<p>Immune to fear.</p>');
  });

  it('deleteTrait removes the trait by id', () => {
    useCharacterStore.getState().addTrait(traitEntry);
    const id = useCharacterStore.getState().character.traits[0].id;
    useCharacterStore.getState().deleteTrait(id);
    expect(useCharacterStore.getState().character.traits).toHaveLength(0);
  });

  it('deleteTrait does not affect other traits', () => {
    useCharacterStore.getState().addTrait(traitEntry);
    useCharacterStore.getState().addTrait({ ...traitEntry, title: 'Lucky' });
    const firstId = useCharacterStore.getState().character.traits[0].id;
    useCharacterStore.getState().deleteTrait(firstId);
    const { traits } = useCharacterStore.getState().character;
    expect(traits).toHaveLength(1);
    expect(traits[0].title).toBe('Lucky');
  });
});

describe('characterStore — notes', () => {
  beforeEach(() => resetStore());

  const noteEntry = {
    title: 'Session 1',
    content: '<p>Met the innkeeper.</p>',
    category: 'note' as const,
  };

  it('addNote appends to notes array', () => {
    useCharacterStore.getState().addNote(noteEntry);
    const { character } = useCharacterStore.getState();
    expect(character.notes).toHaveLength(1);
    expect(character.notes[0].title).toBe('Session 1');
    expect(character.notes[0].id).toBeTruthy();
  });

  it('addNote sets the order property to end of list', () => {
    useCharacterStore.getState().addNote(noteEntry);
    useCharacterStore.getState().addNote({ ...noteEntry, title: 'Session 2' });
    const { notes } = useCharacterStore.getState().character;
    expect(notes[0].order).toBe(0);
    expect(notes[1].order).toBe(1);
  });

  it('addNote sets hasUnsavedChanges', () => {
    useCharacterStore.getState().addNote(noteEntry);
    expect(useCharacterStore.getState().hasUnsavedChanges).toBe(true);
  });

  it('updateNote modifies the note by id', () => {
    useCharacterStore.getState().addNote(noteEntry);
    const id = useCharacterStore.getState().character.notes[0].id;
    useCharacterStore.getState().updateNote(id, {
      title: 'Session 1 - Updated',
      content: '<p>Met the innkeeper. Got a quest.</p>',
    });
    const { notes } = useCharacterStore.getState().character;
    expect(notes[0].title).toBe('Session 1 - Updated');
    expect(notes[0].content).toBe('<p>Met the innkeeper. Got a quest.</p>');
  });

  it('deleteNote removes the note by id', () => {
    useCharacterStore.getState().addNote(noteEntry);
    const id = useCharacterStore.getState().character.notes[0].id;
    useCharacterStore.getState().deleteNote(id);
    expect(useCharacterStore.getState().character.notes).toHaveLength(0);
  });

  it('deleteNote does not affect other notes', () => {
    useCharacterStore.getState().addNote(noteEntry);
    useCharacterStore.getState().addNote({ ...noteEntry, title: 'Session 2' });
    const firstId = useCharacterStore.getState().character.notes[0].id;
    useCharacterStore.getState().deleteNote(firstId);
    const { notes } = useCharacterStore.getState().character;
    expect(notes).toHaveLength(1);
    expect(notes[0].title).toBe('Session 2');
  });

  it('reorderNotes moves a note from sourceIndex to destinationIndex', () => {
    useCharacterStore.getState().addNote({ ...noteEntry, title: 'Note A' });
    useCharacterStore.getState().addNote({ ...noteEntry, title: 'Note B' });
    useCharacterStore.getState().addNote({ ...noteEntry, title: 'Note C' });
    // Move first note to last position
    useCharacterStore.getState().reorderNotes(0, 2);
    const { notes } = useCharacterStore.getState().character;
    expect(notes[0].title).toBe('Note B');
    expect(notes[1].title).toBe('Note C');
    expect(notes[2].title).toBe('Note A');
  });

  it('reorderNotes updates order property to reflect new indices', () => {
    useCharacterStore.getState().addNote({ ...noteEntry, title: 'Note A' });
    useCharacterStore.getState().addNote({ ...noteEntry, title: 'Note B' });
    useCharacterStore.getState().addNote({ ...noteEntry, title: 'Note C' });
    useCharacterStore.getState().reorderNotes(2, 0);
    const { notes } = useCharacterStore.getState().character;
    notes.forEach((note, index) => {
      expect(note.order).toBe(index);
    });
  });

  it('reorderNotes sets hasUnsavedChanges', () => {
    useCharacterStore.getState().addNote({ ...noteEntry, title: 'Note A' });
    useCharacterStore.getState().addNote({ ...noteEntry, title: 'Note B' });
    useCharacterStore.setState({ hasUnsavedChanges: false });
    useCharacterStore.getState().reorderNotes(0, 1);
    expect(useCharacterStore.getState().hasUnsavedChanges).toBe(true);
  });
});

describe('characterStore — background', () => {
  beforeEach(() => resetStore());

  it('updateCharacterBackground updates personality field', () => {
    useCharacterStore
      .getState()
      .updateCharacterBackground({ personality: 'Brave and bold' });
    expect(
      useCharacterStore.getState().character.characterBackground.personality
    ).toBe('Brave and bold');
  });

  it('updateCharacterBackground updates multiple fields at once', () => {
    useCharacterStore.getState().updateCharacterBackground({
      personality: 'Curious',
      ideals: 'Knowledge is power',
      bonds: 'My mentor',
      flaws: 'Overconfident',
    });
    const { characterBackground } = useCharacterStore.getState().character;
    expect(characterBackground.personality).toBe('Curious');
    expect(characterBackground.ideals).toBe('Knowledge is power');
    expect(characterBackground.bonds).toBe('My mentor');
    expect(characterBackground.flaws).toBe('Overconfident');
  });

  it('updateCharacterBackground preserves untouched fields', () => {
    useCharacterStore
      .getState()
      .updateCharacterBackground({ backstory: 'Born in a small village.' });
    useCharacterStore
      .getState()
      .updateCharacterBackground({ personality: 'Kind-hearted' });
    const { characterBackground } = useCharacterStore.getState().character;
    expect(characterBackground.backstory).toBe('Born in a small village.');
    expect(characterBackground.personality).toBe('Kind-hearted');
  });

  it('updateCharacterBackground updates backstory', () => {
    useCharacterStore.getState().updateCharacterBackground({
      backstory: '<p>A long and storied past.</p>',
    });
    expect(
      useCharacterStore.getState().character.characterBackground.backstory
    ).toBe('<p>A long and storied past.</p>');
  });

  it('updateCharacterBackground sets hasUnsavedChanges', () => {
    useCharacterStore
      .getState()
      .updateCharacterBackground({ personality: 'Bold' });
    expect(useCharacterStore.getState().hasUnsavedChanges).toBe(true);
  });

  it('updateCharacterBackground sets saveStatus to saving', () => {
    useCharacterStore
      .getState()
      .updateCharacterBackground({ personality: 'Cautious' });
    expect(useCharacterStore.getState().saveStatus).toBe('saving');
  });
});
