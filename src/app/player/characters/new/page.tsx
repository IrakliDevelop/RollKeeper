'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Dice6, Info, Shield } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogTrigger,
} from '@/components/ui/feedback/dialog-new';
import { ProcessedRace } from '@/utils/raceDataLoader';
import { ProcessedClass } from '@/types/classes';
import {
  formatSpellcastingType,
  formatProficiencyType,
} from '@/utils/classFilters';
import { AvatarUpload } from '@/components/ui/character/AvatarUpload';

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
        alert('Please enter a character name');
        setIsCreating(false);
        return;
      }

      // Find the selected class data from COMMON_CLASSES
      const classData = COMMON_CLASSES.find(c => c.name === selectedClass);

      if (!classData) {
        alert('Invalid class selected');
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
      alert('Failed to create character. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50 shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center">
              <Link href="/player">
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<ArrowLeft size={20} />}
                >
                  Back to Characters
                </Button>
              </Link>
              <h1 className="ml-6 text-xl font-bold text-slate-800">
                Create New Character
              </h1>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-lg border-2 border-blue-200 bg-gradient-to-br from-white to-slate-50 p-8 shadow-lg">
          <div className="mb-8 text-center">
            <Dice6 className="mx-auto mb-4 h-16 w-16 text-blue-600" />
            <h1 className="mb-2 text-3xl font-bold text-slate-800">
              Create Your Character
            </h1>
            <p className="text-slate-600">
              Fill in the basic information to get started. You can customize
              everything else in the character sheet.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Avatar Upload */}
            <div className="flex justify-center">
              <AvatarUpload
                avatar={avatar}
                characterId={tempCharacterId}
                characterName={characterName || 'New Character'}
                onAvatarChange={setAvatar}
                size="xl"
                editable={true}
              />
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* Character Name */}
              <div className="md:col-span-2">
                <label
                  htmlFor="characterName"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Character Name *
                </label>
                <Input
                  type="text"
                  id="characterName"
                  required
                  value={characterName}
                  onChange={e => setCharacterName(e.target.value)}
                  placeholder="e.g., Thorin Ironbeard"
                />
              </div>

              {/* Race */}
              <div>
                <label
                  htmlFor="race"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Race
                </label>
                <div className="flex gap-2">
                  <Autocomplete
                    options={raceOptions}
                    value={selectedRace}
                    onChange={setSelectedRace}
                    placeholder={
                      isLoadingRaces ? 'Loading races...' : 'Search races...'
                    }
                    disabled={isLoadingRaces}
                    className="flex-1"
                  />
                  {selectedRaceData && (
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="md"
                          leftIcon={<Info size={16} />}
                          className="flex-shrink-0"
                        >
                          Details
                        </Button>
                      </DialogTrigger>
                      <DialogContent size="lg">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            <Dice6 className="h-5 w-5 text-blue-600" />
                            {selectedRaceData.name}
                          </DialogTitle>
                          <DialogDescription>
                            Comprehensive racial traits and abilities
                          </DialogDescription>
                        </DialogHeader>
                        <DialogBody className="max-h-[70vh] overflow-y-auto">
                          <div className="space-y-4">
                            {/* Basic Info Grid */}
                            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                              {selectedRaceData.size && (
                                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                                  <span className="text-xs font-medium text-gray-600">
                                    Size
                                  </span>
                                  <p className="mt-1 text-sm font-semibold text-gray-900">
                                    {selectedRaceData.size}
                                  </p>
                                </div>
                              )}
                              {selectedRaceData.darkvision && (
                                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                                  <span className="text-xs font-medium text-gray-600">
                                    Darkvision
                                  </span>
                                  <p className="mt-1 text-sm font-semibold text-gray-900">
                                    {selectedRaceData.darkvision} ft.
                                  </p>
                                </div>
                              )}
                              {selectedRaceData.age && (
                                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                                  <span className="text-xs font-medium text-gray-600">
                                    Lifespan
                                  </span>
                                  <p className="mt-1 text-sm font-semibold text-gray-900">
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
                              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                                <h4 className="mb-2 text-sm font-semibold text-gray-900">
                                  Speed
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                  {selectedRaceData.speed.walk && (
                                    <Badge variant="info" size="md">
                                      Walk: {selectedRaceData.speed.walk} ft.
                                    </Badge>
                                  )}
                                  {selectedRaceData.speed.fly && (
                                    <Badge variant="secondary" size="md">
                                      Fly: {selectedRaceData.speed.fly} ft.
                                    </Badge>
                                  )}
                                  {selectedRaceData.speed.swim && (
                                    <Badge variant="primary" size="md">
                                      Swim: {selectedRaceData.speed.swim} ft.
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Ability Score Increases */}
                            {selectedRaceData.abilityScores &&
                              selectedRaceData.abilityScores.length > 0 && (
                                <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                                  <h4 className="mb-2 text-sm font-semibold text-gray-900">
                                    Ability Score Increase
                                  </h4>
                                  <div className="flex flex-wrap gap-2">
                                    {selectedRaceData.abilityScores.map(
                                      (score, idx) => (
                                        <Badge
                                          key={idx}
                                          variant="success"
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
                                <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
                                  <h4 className="mb-2 text-sm font-semibold text-gray-900">
                                    Languages
                                  </h4>
                                  <div className="flex flex-wrap gap-2">
                                    {selectedRaceData.languages.map(
                                      (lang, idx) => (
                                        <Badge
                                          key={idx}
                                          variant="primary"
                                          size="md"
                                        >
                                          {lang}
                                        </Badge>
                                      )
                                    )}
                                  </div>
                                </div>
                              )}

                            {/* Skill Proficiencies */}
                            {selectedRaceData.skillProficiencies &&
                              selectedRaceData.skillProficiencies.length >
                                0 && (
                                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                                  <h4 className="mb-2 text-sm font-semibold text-gray-900">
                                    Skill Proficiencies
                                  </h4>
                                  <div className="flex flex-wrap gap-2">
                                    {selectedRaceData.skillProficiencies.map(
                                      (skill, idx) => (
                                        <Badge
                                          key={idx}
                                          variant="warning"
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
                              <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                                <h4 className="mb-2 text-sm font-semibold text-gray-900">
                                  Defenses
                                </h4>
                                <div className="space-y-2">
                                  {selectedRaceData.resistances &&
                                    selectedRaceData.resistances.length > 0 && (
                                      <div>
                                        <span className="text-xs font-medium text-gray-700">
                                          Resistances:
                                        </span>
                                        <div className="mt-1 flex flex-wrap gap-1">
                                          {selectedRaceData.resistances.map(
                                            (res, idx) => (
                                              <Badge
                                                key={idx}
                                                variant="danger"
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
                                        <span className="text-xs font-medium text-gray-700">
                                          Immunities:
                                        </span>
                                        <div className="mt-1 flex flex-wrap gap-1">
                                          {selectedRaceData.immunities.map(
                                            (imm, idx) => (
                                              <Badge
                                                key={idx}
                                                variant="danger"
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

                            {/* Racial Features */}
                            {selectedRaceData.features &&
                              selectedRaceData.features.length > 0 && (
                                <div className="space-y-3">
                                  <h4 className="text-sm font-semibold text-gray-900">
                                    Racial Features
                                  </h4>
                                  {selectedRaceData.features.map(
                                    (feature, idx) => (
                                      <div
                                        key={idx}
                                        className="rounded-lg border border-purple-200 bg-purple-50 p-4"
                                      >
                                        <h5 className="mb-2 text-sm font-semibold text-purple-900">
                                          {feature.name}
                                        </h5>
                                        <p className="text-sm leading-relaxed text-gray-700">
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
                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                                  <h4 className="mb-2 text-sm font-semibold text-gray-900">
                                    Tags
                                  </h4>
                                  <div className="flex flex-wrap gap-2">
                                    {selectedRaceData.traits.map(
                                      (trait, idx) => (
                                        <Badge
                                          key={idx}
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
                            <div className="border-t border-gray-200 pt-3">
                              <p className="text-xs text-gray-600">
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
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Class
                </label>
                <div className="flex gap-2">
                  <Select
                    value={selectedClass}
                    onValueChange={setSelectedClass}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select a class..." />
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
                          className="flex-shrink-0"
                        >
                          Details
                        </Button>
                      </DialogTrigger>
                      <DialogContent size="lg">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            <Shield className="h-5 w-5 text-blue-600" />
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
                              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                                <span className="text-xs font-medium text-gray-600">
                                  Hit Die
                                </span>
                                <p className="mt-1 text-sm font-semibold text-gray-900">
                                  {selectedClassData.hitDie}
                                </p>
                              </div>
                              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                                <span className="text-xs font-medium text-gray-600">
                                  Spellcasting
                                </span>
                                <p className="mt-1 text-sm font-semibold text-gray-900">
                                  {formatSpellcastingType(
                                    selectedClassData.spellcasting.type
                                  )}
                                </p>
                              </div>
                              {selectedClassData.spellcasting.ability && (
                                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                                  <span className="text-xs font-medium text-gray-600">
                                    Spellcasting Ability
                                  </span>
                                  <p className="mt-1 text-sm font-semibold text-gray-900">
                                    {selectedClassData.spellcasting.ability.toUpperCase()}
                                  </p>
                                </div>
                              )}
                            </div>

                            {/* Saving Throw Proficiencies */}
                            {selectedClassData.proficiencies.savingThrows &&
                              selectedClassData.proficiencies.savingThrows
                                .length > 0 && (
                                <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                                  <h4 className="mb-2 text-sm font-semibold text-gray-900">
                                    Saving Throw Proficiencies
                                  </h4>
                                  <div className="flex flex-wrap gap-2">
                                    {selectedClassData.proficiencies.savingThrows.map(
                                      (save, idx) => (
                                        <Badge
                                          key={idx}
                                          variant="success"
                                          size="md"
                                        >
                                          {formatProficiencyType(save)}
                                        </Badge>
                                      )
                                    )}
                                  </div>
                                </div>
                              )}

                            {/* Armor Proficiencies */}
                            {selectedClassData.proficiencies.armor &&
                              selectedClassData.proficiencies.armor.length >
                                0 && (
                                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                                  <h4 className="mb-2 text-sm font-semibold text-gray-900">
                                    Armor Proficiencies
                                  </h4>
                                  <div className="flex flex-wrap gap-2">
                                    {selectedClassData.proficiencies.armor.map(
                                      (armor, idx) => (
                                        <Badge
                                          key={idx}
                                          variant="info"
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

                            {/* Weapon Proficiencies */}
                            {selectedClassData.proficiencies.weapons &&
                              selectedClassData.proficiencies.weapons.length >
                                0 && (
                                <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
                                  <h4 className="mb-2 text-sm font-semibold text-gray-900">
                                    Weapon Proficiencies
                                  </h4>
                                  <div className="flex flex-wrap gap-2">
                                    {selectedClassData.proficiencies.weapons.map(
                                      (weapon, idx) => (
                                        <Badge
                                          key={idx}
                                          variant="primary"
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
                              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                                <h4 className="mb-2 text-sm font-semibold text-gray-900">
                                  Skill Proficiencies (Choose{' '}
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
                                        key={idx}
                                        variant="warning"
                                        size="md"
                                      >
                                        {skill}
                                      </Badge>
                                    )
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Multiclassing Requirements */}
                            {selectedClassData.multiclassing &&
                              Object.keys(
                                selectedClassData.multiclassing.requirements
                              ).length > 0 && (
                                <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
                                  <h4 className="mb-2 text-sm font-semibold text-gray-900">
                                    Multiclassing Requirements
                                  </h4>
                                  <div className="flex flex-wrap gap-2">
                                    {Object.entries(
                                      selectedClassData.multiclassing
                                        .requirements
                                    ).map(([ability, score]) => (
                                      <Badge
                                        key={ability}
                                        variant="primary"
                                        size="md"
                                      >
                                        {ability.toUpperCase()} {score}+
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}

                            {/* Starting Equipment */}
                            {selectedClassData.startingEquipment &&
                              selectedClassData.startingEquipment.length >
                                0 && (
                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                                  <h4 className="mb-2 text-sm font-semibold text-gray-900">
                                    Starting Equipment
                                  </h4>
                                  <ul className="space-y-1 text-sm text-gray-700">
                                    {selectedClassData.startingEquipment
                                      .slice(0, 5)
                                      .map((item, idx) => (
                                        <li
                                          key={idx}
                                          className="flex items-start gap-2"
                                        >
                                          <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-gray-400"></span>
                                          <span
                                            dangerouslySetInnerHTML={{
                                              __html: item,
                                            }}
                                          />
                                        </li>
                                      ))}
                                    {selectedClassData.startingEquipment
                                      .length > 5 && (
                                      <li className="text-xs text-gray-600 italic">
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
                                  <h4 className="text-sm font-semibold text-gray-900">
                                    Class Features (First 3 Levels)
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
                                        key={idx}
                                        className="rounded-lg border border-emerald-200 bg-emerald-50 p-4"
                                      >
                                        <div className="mb-1 flex items-center justify-between">
                                          <h5 className="text-sm font-semibold text-emerald-900">
                                            {feature.name}
                                          </h5>
                                          <Badge variant="success" size="sm">
                                            Level {feature.level}
                                          </Badge>
                                        </div>
                                        {feature.entries &&
                                          feature.entries.length > 0 && (
                                            <div
                                              className="text-sm leading-relaxed text-gray-700"
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
                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                                  <h4 className="mb-2 text-sm font-semibold text-gray-900">
                                    Available Subclasses
                                  </h4>
                                  <p className="text-sm text-gray-700">
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
                            <div className="border-t border-gray-200 pt-3">
                              <p className="text-xs text-gray-600">
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

              {/* Player Name */}
              <div className="md:col-span-2">
                <label
                  htmlFor="playerName"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Player Name
                </label>
                <Input
                  type="text"
                  id="playerName"
                  value={playerName}
                  onChange={e => setPlayerName(e.target.value)}
                  placeholder="Your name"
                />
              </div>
            </div>

            {/* Character Preview */}
            <div className="rounded-lg border-2 border-slate-200 bg-slate-50 p-6">
              <h3 className="mb-4 text-lg font-medium text-slate-800">
                Character Preview
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                <div>
                  <span className="text-slate-500">Name:</span>
                  <p className="font-medium text-slate-800">
                    {characterName || 'Character Name'}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Race:</span>
                  <p className="font-medium text-slate-800">{selectedRace}</p>
                </div>
                <div>
                  <span className="text-slate-500">Class:</span>
                  <p className="font-medium text-slate-800">{selectedClass}</p>
                </div>
                <div>
                  <span className="text-slate-500">Level:</span>
                  <p className="font-medium text-slate-800">1</p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-4 border-t border-slate-200 pt-6">
              <Link href="/player">
                <Button variant="ghost">Cancel</Button>
              </Link>
              <Button
                type="submit"
                variant="secondary"
                disabled={isCreating || !characterName.trim()}
                leftIcon={<Save size={16} />}
              >
                {isCreating ? 'Creating...' : 'Create Character'}
              </Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
