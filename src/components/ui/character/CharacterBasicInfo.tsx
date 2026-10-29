'use client';

import { useState } from 'react';
import SimpleClassSelector from '@/components/ui/character/SimpleClassSelector';
import MulticlassManager from '@/components/ui/character/MulticlassManager';
import { Button, Input } from '@/components/ui/forms';
import { InPlaceField } from '@/components/ui/forms/InPlaceField';
import { Section } from '@/components/ui/layout/section';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
} from '@/components/ui/feedback/dialog';
import { SelectField, SelectItem } from '@/components/ui/forms/select';
import { ALIGNMENTS, CREATURE_TYPES } from '@/utils/constants';
import { CharacterState } from '@/types/character';

interface CharacterBasicInfoProps {
  editing?: boolean;
  character: CharacterState;
  race: string;
  characterClass: CharacterState['class'];
  level: number;
  background: string;
  playerName: string;
  alignment: string;
  creatureType: string;
  onUpdateRace: (race: string) => void;
  onUpdateClass: (characterClass: CharacterState['class']) => void;
  onUpdateLevel: (level: number) => void;
  onUpdateBackground: (background: string) => void;
  onUpdatePlayerName: (playerName: string) => void;
  onUpdateAlignment: (alignment: string) => void;
  onUpdateCreatureType: (creatureType: string) => void;
  // Multiclass methods
  onAddClassLevel: (
    className: string,
    isCustom?: boolean,
    spellcaster?: 'full' | 'half' | 'third' | 'warlock' | 'none',
    hitDie?: number,
    subclass?: string
  ) => void;
  onRemoveClassLevel: (className: string) => void;
  onUpdateClassLevel: (className: string, newLevel: number) => void;
  getClassDisplayString: () => string;
}

export default function CharacterBasicInfo({
  character,
  editing = true,
  race,
  characterClass,
  level,
  background,
  playerName,
  alignment,
  creatureType,
  onUpdateRace,
  onUpdateClass,
  onUpdateLevel,
  onUpdateBackground,
  onUpdatePlayerName,
  onUpdateAlignment,
  onUpdateCreatureType,
  onAddClassLevel,
  onRemoveClassLevel,
  onUpdateClassLevel,
  getClassDisplayString,
}: CharacterBasicInfoProps) {
  const [showMulticlassManager, setShowMulticlassManager] = useState(false);

  const isMulticlassed = (character.classes?.length || 0) > 1;
  const classDisplayString = getClassDisplayString();
  const information = [
    ['Race', race],
    ['Class', classDisplayString],
    ['Level', String(level)],
    ['Background', background],
    ['Player name', playerName],
    ['Alignment', alignment],
    ['Creature type', creatureType || 'Humanoid'],
  ];
  return (
    <Section heading="Character information">
      {!editing ? (
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {information.map(([label, value]) => (
            <div
              key={label}
              className={`min-w-0 ${label === 'Class' && !isMulticlassed ? 'pb-6' : ''}`}
            >
              <dt className="text-heading mb-1.5 block text-sm font-medium">
                {label}
              </dt>
              <dd className="type-body text-heading flex min-h-10 items-center break-words pointer-coarse:min-h-11">
                {value || '—'}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Race"
              placeholder="Human"
              value={race}
              onChange={e => onUpdateRace(e.target.value)}
            />
            {isMulticlassed ? (
              <div>
                <span className="type-ui text-muted">Classes</span>
                <p className="type-body text-heading">{classDisplayString}</p>
              </div>
            ) : (
              <SimpleClassSelector
                value={characterClass}
                onChange={onUpdateClass}
              />
            )}
            <div>
              <span className="text-heading mb-1.5 block text-sm font-medium">
                Level
              </span>
              <div className="flex min-h-10 items-center pointer-coarse:min-h-11">
                <InPlaceField
                  label="Level"
                  value={level}
                  min={1}
                  max={20}
                  editing={editing}
                  onCommit={onUpdateLevel}
                />
              </div>
            </div>
            <div>
              <Input
                label="Background"
                type="text"
                placeholder="Soldier"
                value={background}
                onChange={e => onUpdateBackground(e.target.value)}
              />
            </div>
            <div>
              <Input
                label="Player name"
                type="text"
                placeholder="Sam"
                value={playerName}
                onChange={e => onUpdatePlayerName(e.target.value)}
              />
            </div>
            <div>
              <SelectField
                label="Alignment"
                value={alignment}
                onValueChange={onUpdateAlignment}
              >
                {ALIGNMENTS.map(align => (
                  <SelectItem key={align} value={align}>
                    {align}
                  </SelectItem>
                ))}
              </SelectField>
            </div>
            <div>
              <SelectField
                label="Creature type"
                value={creatureType || 'Humanoid'}
                onValueChange={onUpdateCreatureType}
              >
                {CREATURE_TYPES.map(type => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectField>
            </div>
          </div>
          <Button
            className="mt-4"
            variant="secondary"
            onClick={() => setShowMulticlassManager(true)}
          >
            Manage classes
          </Button>
          <Dialog
            open={showMulticlassManager}
            onOpenChange={setShowMulticlassManager}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Manage classes</DialogTitle>
              </DialogHeader>
              <DialogBody>
                {showMulticlassManager && (
                  <MulticlassManager
                    character={character}
                    onAddClassLevel={onAddClassLevel}
                    onRemoveClassLevel={onRemoveClassLevel}
                    onUpdateClassLevel={onUpdateClassLevel}
                  />
                )}
              </DialogBody>
            </DialogContent>
          </Dialog>
        </>
      )}
      {!editing && (
        <div aria-hidden="true" className="mt-4 h-10 pointer-coarse:min-h-11" />
      )}
    </Section>
  );
}
