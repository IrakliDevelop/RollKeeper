'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Info } from 'lucide-react';
import { usePlayerStore } from '@/store/playerStore';
import {
  COMMON_CLASSES,
  DEFAULT_CHARACTER_STATE,
  FALLBACK_RACE_OPTIONS,
} from '@/utils/constants';
import {
  Autocomplete,
  AutocompleteOption,
  Button,
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/forms';
import { Badge } from '@/components/ui/layout/badge';
import { AppHeader } from '@/components/ui/layout/AppHeader';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogTrigger,
} from '@/components/ui/feedback/dialog';
import { ProcessedRace } from '@/utils/raceDataLoader';
import { ProcessedClass } from '@/types/classes';
import {
  formatSpellcastingType,
  formatProficiencyType,
} from '@/utils/classFilters';
import { AvatarUpload } from '@/components/ui/character/AvatarUpload';
import { alertDialog } from '@/components/ui/feedback/confirm-dialog';

export default function NewCharacterPage() {
  const router = useRouter();
  const { createCharacter } = usePlayerStore();

  const [characterName, setCharacterName] = useState('');
  const [selectedRace, setSelectedRace] = useState('Human');
  const [selectedClass, setSelectedClass] = useState('Fighter');
  const [playerName, setPlayerName] = useState('');
  const [avatar, setAvatar] = useState<string | undefined>(undefined);
  const [isCreating, setIsCreating] = useState(false);
  const [raceOptions, setRaceOptions] = useState<AutocompleteOption[]>([]);
  const [races, setRaces] = useState<ProcessedRace[]>([]);

  // Generate a temporary ID for avatar uploads (will be replaced when character is created)
  const [tempCharacterId] = useState(
    () => `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  );
  const [isLoadingRaces, setIsLoadingRaces] = useState(true);
  const [classes, setClasses] = useState<ProcessedClass[]>([]);
  const [isLoadingClasses, setIsLoadingClasses] = useState(true);

  // Get selected race details
  const selectedRaceData = races.find(race => race.name === selectedRace);

  // Get selected class details
  const selectedClassData = classes.find(cls => cls.name === selectedClass);

  // Load races from JSON
  useEffect(() => {
    async function loadRaces() {
      try {
        const response = await fetch('/api/races');
        const racesData: ProcessedRace[] = await response.json();

        setRaces(racesData);

        const options = racesData.map(race => ({
          value: race.name,
          label: race.displayName,
        }));

        setRaceOptions(options);
      } catch (error) {
        console.error('Failed to load races:', error);
        // Fallback to basic races if loading fails
        setRaceOptions(FALLBACK_RACE_OPTIONS);
      } finally {
        setIsLoadingRaces(false);
      }
    }

    loadRaces();
  }, []);

  // Load classes from API
  useEffect(() => {
    async function loadClasses() {
      try {
        const response = await fetch('/api/classes');
        const data = await response.json();
        const classesData: ProcessedClass[] = data.classes || [];

        setClasses(classesData);
      } catch (error) {
        console.error('Failed to load classes:', error);
      } finally {
        setIsLoadingClasses(false);
      }
    }

    loadClasses();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);

    try {
      if (!characterName.trim()) {
        void alertDialog({ title: 'Enter a character name' });
        setIsCreating(false);
        return;
      }

      // Find the selected class data from COMMON_CLASSES
      const classData = COMMON_CLASSES.find(c => c.name === selectedClass);

      if (!classData) {
        void alertDialog({ title: 'Choose a class from the list' });
        setIsCreating(false);
        return;
      }

      // Create partial character data with the selected options
      const partialCharacterData = {
        ...DEFAULT_CHARACTER_STATE,
        name: characterName.trim(),
        race: selectedRace,
        avatar: avatar, // Add avatar to character data
        class: {
          name: classData.name,
          isCustom: false,
          spellcaster: classData.spellcaster,
          hitDie: classData.hitDie,
        },
        hitDice: `1d${classData.hitDie}`,
        hitPoints: {
          current: classData.hitDie,
          max: classData.hitDie,
          temporary: 0,
          calculationMode: 'auto' as const,
          manualMaxOverride: undefined,
          deathSaves: undefined,
        },
        playerName: playerName.trim() || 'Player',
        level: 1,
      };

      const characterId = createCharacter(
        characterName.trim(),
        partialCharacterData
      );

      // Navigate to the new character sheet
      router.push(`/player/characters/${characterId}`);
    } catch (error) {
      console.error('Failed to create character:', error);
      void alertDialog({ title: "Couldn't create the character. Try again." });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="bg-surface min-h-screen">
      <AppHeader
        leading={
          <Button
            asChild
            variant="ghost"
            size="sm"
            leftIcon={<ArrowLeft size={18} aria-hidden />}
          >
            <Link href="/player">Characters</Link>
          </Button>
        }
        title={<h1 className="type-heading text-heading">New character</h1>}
      />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="type-body text-muted mb-8">
          Pick a name, race and class. You can change the rest on the sheet.
        </p>
        <div>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Avatar Upload */}
            <div className="flex justify-center">
              <AvatarUpload
                avatar={avatar}
                characterId={tempCharacterId}
                characterName={characterName || 'New character'}
                onAvatarChange={setAvatar}
                size="xl"
                editable={true}
              />
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* Character name */}
              <div className="md:col-span-2">
                <label
                  htmlFor="characterName"
                  className="text-heading mb-2 block text-sm font-medium"
                >
                  Character name
                </label>
                <Input
                  type="text"
                  id="characterName"
                  required
                  value={characterName}
                  onChange={e => setCharacterName(e.target.value)}
                  placeholder="Thalia Vane"
                />
              </div>

              {/* Race */}
              <div>
                <label
                  htmlFor="race"
                  className="text-heading mb-2 block text-sm font-medium"
                >
                  Race
                </label>
                <div className="flex min-w-0 flex-wrap gap-2">
                  <Autocomplete
                    inputId="race"
                    options={raceOptions}
                    value={selectedRace}
                    onChange={setSelectedRace}
                    placeholder={
                      isLoadingRaces ? 'Loading races…' : 'Search races'
                    }
                    disabled={isLoadingRaces}
                    className="min-w-40 flex-1"
                  />
                  {selectedRaceData && (
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="md"
                          leftIcon={<Info size={16} />}
                          className="shrink-0"
                        >
                          Details
                        </Button>
                      </DialogTrigger>
                      <DialogContent size="lg">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            {selectedRaceData.name}
                          </DialogTitle>
                          <DialogDescription>
                            Traits and abilities
                          </DialogDescription>
                        </DialogHeader>
                        <DialogBody className="max-h-[70vh] overflow-y-auto">
                          <div className="space-y-4">
                            {/* Basic Info Grid */}
                            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                              {selectedRaceData.size && (
                                <div className="border-divider border-b py-3">
                                  <span className="text-muted text-xs font-medium">
                                    Size
                                  </span>
                                  <p className="text-heading mt-1 text-sm font-semibold">
                                    {selectedRaceData.size}
                                  </p>
                                </div>
                              )}
                              {selectedRaceData.darkvision && (
                                <div className="border-divider border-b py-3">
                                  <span className="text-muted text-xs font-medium">
                                    Darkvision
                                  </span>
                                  <p className="text-heading mt-1 text-sm font-semibold">
                                    {selectedRaceData.darkvision} ft.
                                  </p>
                                </div>
                              )}
                              {selectedRaceData.age && (
                                <div className="border-divider border-b py-3">
                                  <span className="text-muted text-xs font-medium">
                                    Lifespan
                                  </span>
                                  <p className="text-heading mt-1 text-sm font-semibold">
                                    {selectedRaceData.age.max
                                      ? `Up to ${selectedRaceData.age.max} years`
                                      : selectedRaceData.age.mature
                                        ? `Matures at ${selectedRaceData.age.mature}`
                                        : 'Varies'}
                                  </p>
                                </div>
                              )}
                            </div>

                            {/* Speed */}
                            {selectedRaceData.speed && (
                              <div className="border-divider border-b py-4">
                                <h4 className="text-heading mb-2 text-sm font-semibold">
                                  Speed
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                  {selectedRaceData.speed.walk && (
                                    <Badge variant="neutral" size="md">
                                      Walk: {selectedRaceData.speed.walk} ft.
                                    </Badge>
                                  )}
                                  {selectedRaceData.speed.fly && (
                                    <Badge variant="neutral" size="md">
                                      Fly: {selectedRaceData.speed.fly} ft.
                                    </Badge>
                                  )}
                                  {selectedRaceData.speed.swim && (
                                    <Badge variant="neutral" size="md">
                                      Swim: {selectedRaceData.speed.swim} ft.
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Ability score increases */}
                            {selectedRaceData.abilityScores &&
                              selectedRaceData.abilityScores.length > 0 && (
                                <div className="border-divider border-b py-4">
                                  <h4 className="text-heading mb-2 text-sm font-semibold">
                                    Ability score increase
                                  </h4>
                                  <div className="flex flex-wrap gap-2">
                                    {selectedRaceData.abilityScores.map(
                                      (score, idx) => (
                                        <Badge
                                          key={`${score}-${idx}`}
                                          variant="neutral"
                                          size="md"
                                        >
                                          {score}
                                        </Badge>
                                      )
                                    )}
                                  </div>
                                </div>
                              )}

                            {/* Languages */}
                            {selectedRaceData.languages &&
                              selectedRaceData.languages.length > 0 && (
                                <div className="border-divider border-b py-4">
                                  <h4 className="text-heading mb-2 text-sm font-semibold">
                                    Languages
                                  </h4>
                                  <div className="flex flex-wrap gap-2">
                                    {selectedRaceData.languages.map(
                                      (lang, idx) => (
                                        <Badge
                                          key={`${lang}-${idx}`}
                                          variant="neutral"
                                          size="md"
                                        >
                                          {lang}
                                        </Badge>
                                      )
                                    )}
                                  </div>
                                </div>
                              )}

                            {/* Skill proficiencies */}
                            {selectedRaceData.skillProficiencies &&
                              selectedRaceData.skillProficiencies.length >
                                0 && (
                                <div className="border-divider border-b py-4">
                                  <h4 className="text-heading mb-2 text-sm font-semibold">
                                    Skill proficiencies
                                  </h4>
                                  <div className="flex flex-wrap gap-2">
                                    {selectedRaceData.skillProficiencies.map(
                                      (skill, idx) => (
                                        <Badge
                                          key={`${skill}-${idx}`}
                                          variant="neutral"
                                          size="md"
                                        >
                                          {skill}
                                        </Badge>
                                      )
                                    )}
                                  </div>
                                </div>
                              )}

                            {/* Resistances & Immunities */}
                            {((selectedRaceData.resistances &&
                              selectedRaceData.resistances.length > 0) ||
                              (selectedRaceData.immunities &&
                                selectedRaceData.immunities.length > 0)) && (
                              <div className="border-divider border-b py-4">
                                <h4 className="text-heading mb-2 text-sm font-semibold">
                                  Defenses
                                </h4>
                                <div className="space-y-2">
                                  {selectedRaceData.resistances &&
                                    selectedRaceData.resistances.length > 0 && (
                                      <div>
                                        <span className="text-body text-xs font-medium">
                                          Resistances:
                                        </span>
                                        <div className="mt-1 flex flex-wrap gap-1">
                                          {selectedRaceData.resistances.map(
                                            (res, idx) => (
                                              <Badge
                                                key={`${res}-${idx}`}
                                                variant="neutral"
                                                size="sm"
                                              >
                                                {res}
                                              </Badge>
                                            )
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  {selectedRaceData.immunities &&
                                    selectedRaceData.immunities.length > 0 && (
                                      <div>
                                        <span className="text-body text-xs font-medium">
                                          Immunities:
                                        </span>
                                        <div className="mt-1 flex flex-wrap gap-1">
                                          {selectedRaceData.immunities.map(
                                            (imm, idx) => (
                                              <Badge
                                                key={`${imm}-${idx}`}
                                                variant="neutral"
                                                size="sm"
                                              >
                                                {imm}
                                              </Badge>
                                            )
                                          )}
                                        </div>
                                      </div>
                                    )}
                                </div>
                              </div>
                            )}

                            {/* Racial features */}
                            {selectedRaceData.features &&
                              selectedRaceData.features.length > 0 && (
                                <div className="space-y-3">
                                  <h4 className="text-heading text-sm font-semibold">
                                    Racial features
                                  </h4>
                                  {selectedRaceData.features.map(
                                    (feature, idx) => (
                                      <div
                                        key={`${feature.name}-${idx}`}
                                        className="border-divider border-b py-4"
                                      >
                                        <h5 className="text-heading mb-2 text-sm font-semibold">
                                          {feature.name}
                                        </h5>
                                        <p className="text-body text-sm leading-relaxed">
                                          {feature.description}
                                        </p>
                                      </div>
                                    )
                                  )}
                                </div>
                              )}

                            {/* Trait Tags */}
                            {selectedRaceData.traits &&
                              selectedRaceData.traits.length > 0 && (
                                <div className="border-divider border-b py-4">
                                  <h4 className="text-heading mb-2 text-sm font-semibold">
                                    Tags
                                  </h4>
                                  <div className="flex flex-wrap gap-2">
                                    {selectedRaceData.traits.map(
                                      (trait, idx) => (
                                        <Badge
                                          key={`${trait}-${idx}`}
                                          variant="neutral"
                                          size="sm"
                                        >
                                          {trait}
                                        </Badge>
                                      )
                                    )}
                                  </div>
                                </div>
                              )}

                            {/* Source */}
                            <div className="border-divider border-t pt-3">
                              <p className="text-muted text-xs">
                                <span className="font-medium">Source:</span>{' '}
                                {selectedRaceData.source}
                              </p>
                            </div>
                          </div>
                        </DialogBody>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </div>

              {/* Class */}
              <div>
                <label
                  htmlFor="class"
                  className="text-heading mb-2 block text-sm font-medium"
                >
                  Class
                </label>
                <div className="flex min-w-0 flex-wrap gap-2">
                  <Select
                    value={selectedClass}
                    onValueChange={setSelectedClass}
                  >
                    <SelectTrigger id="class" className="min-w-40 flex-1">
                      <SelectValue placeholder="Choose a class" />
                    </SelectTrigger>
                    <SelectContent>
                      {COMMON_CLASSES.map(classData => (
                        <SelectItem
                          key={classData.name}
                          value={classData.name}
                          description={
                            classData.spellcaster !== 'none'
                              ? `${
                                  classData.spellcaster === 'full'
                                    ? 'Full'
                                    : classData.spellcaster === 'half'
                                      ? 'Half'
                                      : classData.spellcaster === 'third'
                                        ? '1/3'
                                        : 'Pact'
                                } Caster`
                              : 'Non-spellcaster'
                          }
                        >
                          {classData.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedClassData && !isLoadingClasses && (
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="md"
                          leftIcon={<Info size={16} />}
                          className="shrink-0"
                        >
                          Details
                        </Button>
                      </DialogTrigger>
                      <DialogContent size="lg">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            {selectedClassData.name}
                          </DialogTitle>
                          <DialogDescription>
                            Class features and proficiencies
                          </DialogDescription>
                        </DialogHeader>
                        <DialogBody className="max-h-[70vh] overflow-y-auto">
                          <div className="space-y-4">
                            {/* Basic Info Grid */}
                            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                              <div className="border-divider border-b py-3">
                                <span className="text-muted text-xs font-medium">
                                  Hit die
                                </span>
                                <p className="text-heading mt-1 text-sm font-semibold">
                                  {selectedClassData.hitDie}
                                </p>
                              </div>
                              <div className="border-divider border-b py-3">
                                <span className="text-muted text-xs font-medium">
                                  Spellcasting
                                </span>
                                <p className="text-heading mt-1 text-sm font-semibold">
                                  {formatSpellcastingType(
                                    selectedClassData.spellcasting.type
                                  )}
                                </p>
                              </div>
                              {selectedClassData.spellcasting.ability && (
                                <div className="border-divider border-b py-3">
                                  <span className="text-muted text-xs font-medium">
                                    Spellcasting ability
                                  </span>
                                  <p className="text-heading mt-1 text-sm font-semibold">
                                    {selectedClassData.spellcasting.ability.toUpperCase()}
                                  </p>
                                </div>
                              )}
                            </div>

                            {/* Saving throw proficiencies */}
                            {selectedClassData.proficiencies.savingThrows &&
                              selectedClassData.proficiencies.savingThrows
                                .length > 0 && (
                                <div className="border-divider border-b py-4">
                                  <h4 className="text-heading mb-2 text-sm font-semibold">
                                    Saving throw proficiencies
                                  </h4>
                                  <div className="flex flex-wrap gap-2">
                                    {selectedClassData.proficiencies.savingThrows.map(
                                      (save, idx) => (
                                        <Badge
                                          key={`${save}-${idx}`}
                                          variant="neutral"
                                          size="md"
                                        >
                                          {formatProficiencyType(save)}
                                        </Badge>
                                      )
                                    )}
                                  </div>
                                </div>
                              )}

                            {/* Armor proficiencies */}
                            {selectedClassData.proficiencies.armor &&
                              selectedClassData.proficiencies.armor.length >
                                0 && (
                                <div className="border-divider border-b py-4">
                                  <h4 className="text-heading mb-2 text-sm font-semibold">
                                    Armor proficiencies
                                  </h4>
                                  <div className="flex flex-wrap gap-2">
                                    {selectedClassData.proficiencies.armor.map(
                                      (armor, idx) => (
                                        <Badge
                                          key={`${armor}-${idx}`}
                                          variant="neutral"
                                          size="md"
                                        >
                                          <span
                                            dangerouslySetInnerHTML={{
                                              __html: armor,
                                            }}
                                          />
                                        </Badge>
                                      )
                                    )}
                                  </div>
                                </div>
                              )}

                            {/* Weapon proficiencies */}
                            {selectedClassData.proficiencies.weapons &&
                              selectedClassData.proficiencies.weapons.length >
                                0 && (
                                <div className="border-divider border-b py-4">
                                  <h4 className="text-heading mb-2 text-sm font-semibold">
                                    Weapon proficiencies
                                  </h4>
                                  <div className="flex flex-wrap gap-2">
                                    {selectedClassData.proficiencies.weapons.map(
                                      (weapon, idx) => (
                                        <Badge
                                          key={`${weapon}-${idx}`}
                                          variant="neutral"
                                          size="md"
                                        >
                                          <span
                                            dangerouslySetInnerHTML={{
                                              __html: weapon,
                                            }}
                                          />
                                        </Badge>
                                      )
                                    )}
                                  </div>
                                </div>
                              )}

                            {/* Skill Choices */}
                            {selectedClassData.proficiencies.skillChoices && (
                              <div className="border-divider border-b py-4">
                                <h4 className="text-heading mb-2 text-sm font-semibold">
                                  Skill proficiencies (choose{' '}
                                  {
                                    selectedClassData.proficiencies.skillChoices
                                      .count
                                  }
                                  )
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                  {selectedClassData.proficiencies.skillChoices.from.map(
                                    (skill, idx) => (
                                      <Badge
                                        key={`${skill}-${idx}`}
                                        variant="neutral"
                                        size="md"
                                      >
                                        {skill}
                                      </Badge>
                                    )
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Multiclassing requirements */}
                            {selectedClassData.multiclassing &&
                              Object.keys(
                                selectedClassData.multiclassing.requirements
                              ).length > 0 && (
                                <div className="border-divider border-b py-4">
                                  <h4 className="text-heading mb-2 text-sm font-semibold">
                                    Multiclassing requirements
                                  </h4>
                                  <div className="flex flex-wrap gap-2">
                                    {Object.entries(
                                      selectedClassData.multiclassing
                                        .requirements
                                    ).map(([ability, score]) => (
                                      <Badge
                                        key={ability}
                                        variant="neutral"
                                        size="md"
                                      >
                                        {ability.toUpperCase()} {score}+
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}

                            {/* Starting equipment */}
                            {selectedClassData.startingEquipment &&
                              selectedClassData.startingEquipment.length >
                                0 && (
                                <div className="border-divider border-b py-4">
                                  <h4 className="text-heading mb-2 text-sm font-semibold">
                                    Starting equipment
                                  </h4>
                                  <ul className="text-body space-y-1 text-sm">
                                    {selectedClassData.startingEquipment
                                      .slice(0, 5)
                                      .map((item, idx) => (
                                        <li
                                          key={`${item}-${idx}`}
                                          className="flex items-start gap-2"
                                        >
                                          <span className="bg-faint mt-1.5 h-1 w-1 shrink-0 rounded-full"></span>
                                          <span
                                            dangerouslySetInnerHTML={{
                                              __html: item,
                                            }}
                                          />
                                        </li>
                                      ))}
                                    {selectedClassData.startingEquipment
                                      .length > 5 && (
                                      <li className="text-muted text-xs italic">
                                        ...and{' '}
                                        {selectedClassData.startingEquipment
                                          .length - 5}{' '}
                                        more items
                                      </li>
                                    )}
                                  </ul>
                                </div>
                              )}

                            {/* Class Features Preview */}
                            {selectedClassData.features &&
                              selectedClassData.features.length > 0 && (
                                <div className="space-y-3">
                                  <h4 className="text-heading text-sm font-semibold">
                                    Class features (first 3 levels)
                                  </h4>
                                  {selectedClassData.features
                                    .filter(
                                      feature =>
                                        !feature.isSubclassFeature &&
                                        feature.level <= 3
                                    )
                                    .slice(0, 5)
                                    .map((feature, idx) => (
                                      <div
                                        key={`${feature.name}-${idx}`}
                                        className="border-divider border-b py-4"
                                      >
                                        <div className="mb-1 flex items-center justify-between">
                                          <h5 className="text-heading text-sm font-semibold">
                                            {feature.name}
                                          </h5>
                                          <Badge variant="neutral" size="sm">
                                            Level {feature.level}
                                          </Badge>
                                        </div>
                                        {feature.entries &&
                                          feature.entries.length > 0 && (
                                            <div
                                              className="text-body text-sm leading-relaxed"
                                              dangerouslySetInnerHTML={{
                                                __html:
                                                  feature.entries[0].substring(
                                                    0,
                                                    150
                                                  ) +
                                                  (feature.entries[0].length >
                                                  150
                                                    ? '...'
                                                    : ''),
                                              }}
                                            />
                                          )}
                                      </div>
                                    ))}
                                </div>
                              )}

                            {/* Subclasses Count */}
                            {selectedClassData.subclasses &&
                              selectedClassData.subclasses.length > 0 && (
                                <div className="border-divider border-b py-4">
                                  <h4 className="text-heading mb-2 text-sm font-semibold">
                                    Available subclasses
                                  </h4>
                                  <p className="text-body text-sm">
                                    This class has{' '}
                                    <strong>
                                      {selectedClassData.subclasses.length}
                                    </strong>{' '}
                                    subclass
                                    {selectedClassData.subclasses.length !== 1
                                      ? 'es'
                                      : ''}{' '}
                                    available.
                                  </p>
                                </div>
                              )}

                            {/* Source */}
                            <div className="border-divider border-t pt-3">
                              <p className="text-muted text-xs">
                                <span className="font-medium">Source:</span>{' '}
                                {selectedClassData.source}
                                {selectedClassData.page &&
                                  ` • Page ${selectedClassData.page}`}
                              </p>
                            </div>
                          </div>
                        </DialogBody>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </div>

              {/* Player name */}
              <div className="md:col-span-2">
                <label
                  htmlFor="playerName"
                  className="text-heading mb-2 block text-sm font-medium"
                >
                  Player name
                </label>
                <Input
                  type="text"
                  id="playerName"
                  value={playerName}
                  onChange={e => setPlayerName(e.target.value)}
                />
              </div>
            </div>

            {/* Character preview */}
            <div className="border-divider border-t pt-6">
              <h3 className="text-heading mb-4 text-lg font-medium">
                Character preview
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                <div>
                  <span className="text-muted">Name:</span>
                  <p className="text-heading font-medium">
                    {characterName || 'Character name'}
                  </p>
                </div>
                <div>
                  <span className="text-muted">Race:</span>
                  <p className="text-heading font-medium">{selectedRace}</p>
                </div>
                <div>
                  <span className="text-muted">Class:</span>
                  <p className="text-heading font-medium">{selectedClass}</p>
                </div>
                <div>
                  <span className="text-muted">Level:</span>
                  <p className="text-heading font-medium">1</p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="border-divider flex items-center justify-end gap-4 border-t pt-6">
              <Button asChild variant="ghost">
                <Link href="/player">Cancel</Link>
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={isCreating || !characterName.trim()}
                leftIcon={<Save size={16} />}
              >
                {isCreating ? 'Creating…' : 'Create character'}
              </Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
