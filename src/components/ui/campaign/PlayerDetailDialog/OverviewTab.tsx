'use client';

import React from 'react';
import { Switch } from '@/components/ui/forms/switch';
import { LedgerRow, type LedgerCell } from '@/components/ui/game/LedgerRow';
import { ConditionChip } from '@/components/ui/game/ConditionChip';
import {
  ProficiencyDot,
  type ProficiencyLevel,
} from '@/components/ui/game/ProficiencyDot';
import { Badge } from '@/components/ui/layout/badge';
import { Section } from '@/components/ui/layout/section';
import { CounterStepper } from '@/components/ui/campaign/CounterStepper';
import { HpReadout } from '@/components/ui/campaign/HpReadout';
import { XpAwardControl } from '@/components/ui/campaign/XpAwardControl';
import { ensureArray, formatMod } from './shared';
import { calculateEncumbrance, EncumbranceInfo } from '@/utils/encumbrance';
import {
  calculateModifier,
  getProficiencyBonus,
  calculateCharacterArmorClass,
} from '@/utils/calculations';
import { useUiPrefs } from '@/hooks/useUiPrefs';
import { CharacterState } from '@/types/character';

const ABILITY_KEYS = [
  'strength',
  'dexterity',
  'constitution',
  'intelligence',
  'wisdom',
  'charisma',
] as const;

const ABILITY_LABELS: Record<string, string> = {
  strength: 'STR',
  dexterity: 'DEX',
  constitution: 'CON',
  intelligence: 'INT',
  wisdom: 'WIS',
  charisma: 'CHA',
};

const SKILL_ENTRIES: Array<{ key: string; ability: string }> = [
  { key: 'acrobatics', ability: 'dexterity' },
  { key: 'animalHandling', ability: 'wisdom' },
  { key: 'arcana', ability: 'intelligence' },
  { key: 'athletics', ability: 'strength' },
  { key: 'deception', ability: 'charisma' },
  { key: 'history', ability: 'intelligence' },
  { key: 'insight', ability: 'wisdom' },
  { key: 'intimidation', ability: 'charisma' },
  { key: 'investigation', ability: 'intelligence' },
  { key: 'medicine', ability: 'wisdom' },
  { key: 'nature', ability: 'intelligence' },
  { key: 'perception', ability: 'wisdom' },
  { key: 'performance', ability: 'charisma' },
  { key: 'persuasion', ability: 'charisma' },
  { key: 'religion', ability: 'intelligence' },
  { key: 'sleightOfHand', ability: 'dexterity' },
  { key: 'stealth', ability: 'dexterity' },
  { key: 'survival', ability: 'wisdom' },
];

function formatSkillName(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, s => s.toUpperCase())
    .trim();
}

/**
 * The six ledger cells from a synced character. Saves use this dialog's
 * proficiency bonus (total level) and read older blobs safely.
 */
function abilityCells(char: CharacterState, profBonus: number): LedgerCell[] {
  return ABILITY_KEYS.map(ability => {
    const score = char.abilities?.[ability] ?? 10;
    const modifier = calculateModifier(score);
    const save = char.savingThrows?.[ability];
    const saveProficient = save?.proficient ?? false;
    return {
      ability,
      score,
      modifier,
      save:
        modifier +
        (saveProficient ? profBonus : 0) +
        (save?.customModifier ?? 0),
      saveProficient,
    };
  });
}

interface OverviewTabProps {
  char: CharacterState;
  /** The character's display name, for labels naming whose tally it is. */
  name: string;
  customCounterLabel?: string;
  counterValue: number;
  onAdjustCounter?: (delta: number) => void;
  campaignCode?: string;
  dmId?: string;
  playerId?: string;
  projectedExperience?: number;
  pendingXpAwardCount?: number;
}

const MAX_INSPIRATION_PIPS = 10;

function skillLevel(
  proficient: boolean,
  expertise: boolean,
  jackOfAllTrades: boolean
): ProficiencyLevel {
  if (expertise) return 'expertise';
  if (proficient) return 'proficient';
  return jackOfAllTrades ? 'half' : 'none';
}

export function OverviewTab({
  char,
  name,
  customCounterLabel,
  counterValue,
  onAdjustCounter,
  campaignCode,
  dmId,
  playerId,
  projectedExperience,
  pendingXpAwardCount,
}: OverviewTabProps) {
  const ac = calculateCharacterArmorClass(char);
  const level = char.totalLevel || char.level || 1;
  const profBonus = getProficiencyBonus(level);
  const encumbrance = calculateEncumbrance(char);
  const inspirationCount = char.heroicInspiration?.count ?? 0;
  const attunement = char.attunementSlots;
  const dexMod = calculateModifier(char.abilities?.dexterity ?? 10);
  const initBonus = char.initiative?.isOverridden
    ? char.initiative.value
    : dexMod;
  const { prefs, setPref, localChange } = useUiPrefs();
  const cells = React.useMemo(
    () => abilityCells(char, profBonus),
    [char, profBonus]
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,16rem)_1fr]">
        <HpReadout
          current={char.hitPoints?.current ?? 0}
          max={char.hitPoints?.max ?? 0}
          temp={char.hitPoints?.temporary ?? 0}
          size="md"
        />
        <dl className="flex flex-wrap content-start gap-x-4 gap-y-1">
          <div className="type-ui flex gap-1">
            <dt className="text-muted">AC</dt>
            <dd className="text-heading tabular-nums">
              {ac}
              {char.isTempACActive && (
                <>
                  {' '}
                  <span className="type-small text-muted">temporary AC</span>
                </>
              )}
            </dd>
          </div>
          <div className="type-ui flex gap-1">
            <dt className="text-muted">Speed</dt>
            <dd className="text-heading tabular-nums">{char.speed ?? 30} ft</dd>
          </div>
          <div className="type-ui flex gap-1">
            <dt className="text-muted">Initiative</dt>
            <dd className="text-heading tabular-nums">
              {formatMod(initBonus)}
            </dd>
          </div>
          <div className="type-ui flex gap-1">
            <dt className="text-muted">Proficiency bonus</dt>
            <dd className="text-heading tabular-nums">
              {formatMod(profBonus)}
            </dd>
          </div>
        </dl>
      </div>

      <div className="flex flex-wrap items-center gap-6">
        <div
          role="img"
          aria-label={`Heroic inspiration ${inspirationCount}`}
          className="flex items-center gap-2"
        >
          <span className="type-small text-muted">Heroic inspiration</span>
          {inspirationCount > 0 ? (
            Array.from(
              { length: Math.min(inspirationCount, MAX_INSPIRATION_PIPS) },
              (_, i) => (
                // Pips are positions, not items: index is the identity.
                <span
                  key={i}
                  className="border-brass-border bg-brass-fill size-2.5 rounded-full border-[1.5px]"
                />
              )
            )
          ) : (
            <span className="type-ui text-muted">0</span>
          )}
        </div>
        {customCounterLabel && onAdjustCounter && (
          <CounterStepper
            label={customCounterLabel}
            value={counterValue}
            name={name}
            onAdjust={onAdjustCounter}
          />
        )}
      </div>

      <Section
        level={3}
        heading="Abilities"
        trailing={
          <Switch
            label="Scores large"
            size="sm"
            checked={prefs.abilityDisplay === 'score'}
            onCheckedChange={on =>
              setPref('abilityDisplay', on ? 'score' : 'modifier')
            }
          />
        }
      >
        <LedgerRow
          cells={cells}
          abilityDisplay={prefs.abilityDisplay}
          animateSwap={localChange}
        />
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section level={3} heading="Skills">
          <ul className="grid gap-x-6 gap-y-0.5 sm:grid-cols-2">
            {SKILL_ENTRIES.map(({ key, ability }) => {
              const skill = char.skills?.[key as keyof typeof char.skills];
              const isProficient = skill?.proficient ?? false;
              const isExpertise = skill?.expertise ?? false;
              const abilityScore =
                char.abilities?.[ability as keyof typeof char.abilities] ?? 10;
              const abilityMod = calculateModifier(abilityScore);

              let totalMod = abilityMod + (skill?.customModifier ?? 0);
              if (isExpertise) {
                totalMod += profBonus * 2;
              } else if (isProficient) {
                totalMod += profBonus;
              } else if (char.jackOfAllTrades) {
                totalMod += Math.floor(profBonus / 2);
              }

              return (
                <li
                  key={key}
                  className="type-small flex items-center justify-between gap-2"
                >
                  <span className="flex items-center gap-1.5">
                    <ProficiencyDot
                      level={skillLevel(
                        isProficient,
                        isExpertise,
                        char.jackOfAllTrades ?? false
                      )}
                    />
                    <span className="text-body">{formatSkillName(key)}</span>
                    <span className="text-muted">
                      ({ABILITY_LABELS[ability]})
                    </span>
                  </span>
                  <span className="text-heading tabular-nums">
                    {formatMod(totalMod)}
                  </span>
                </li>
              );
            })}
          </ul>
        </Section>

        <div className="space-y-6">
          <ConditionsSection char={char} />
          <DefensesSection char={char} />
          <SensesSection char={char} />
          <LanguagesSection char={char} />

          {attunement && (
            <Section level={3} heading="Attunement">
              <p className="type-ui text-body">
                {attunement.used} of {attunement.max} attunement slots used
              </p>
            </Section>
          )}
        </div>

        {campaignCode && dmId && playerId && (
          <div className="lg:col-span-2">
            <XpAwardControl
              campaignCode={campaignCode}
              dmId={dmId}
              playerId={playerId}
              lastSyncedXp={char.experience ?? 0}
              currentLevel={level}
              projectedXp={projectedExperience}
              pendingAwardCount={pendingXpAwardCount}
            />
          </div>
        )}

        <div className="space-y-6">
          <Section level={3} heading="Encumbrance">
            <div className="flex items-center justify-between gap-3">
              <span className="type-ui text-body tabular-nums">
                {encumbrance.totalWeight} / {encumbrance.carryCapacity} lb.
              </span>
              <EncumbranceBadge status={encumbrance.status} />
            </div>
            <div
              aria-hidden="true"
              className="bg-surface-inset mt-2 h-2 w-full overflow-hidden rounded-full"
            >
              <div
                className={`h-full rounded-full ${getEncumbranceBarColor(encumbrance.status)}`}
                style={{
                  width: `${
                    encumbrance.carryCapacity > 0
                      ? Math.min(
                          100,
                          (encumbrance.totalWeight /
                            encumbrance.carryCapacity) *
                            100
                        )
                      : 0
                  }%`,
                }}
              />
            </div>
          </Section>

          <CurrencySection char={char} />
        </div>
      </div>
    </div>
  );
}

// ── Subcomponents ──

function ConditionsSection({ char }: { char: CharacterState }) {
  const conditions = ensureArray<
    (typeof char.conditionsAndDiseases.activeConditions)[number]
  >(char.conditionsAndDiseases?.activeConditions);
  const diseases = ensureArray<
    (typeof char.conditionsAndDiseases.activeDiseases)[number]
  >(char.conditionsAndDiseases?.activeDiseases);
  const concentratingOn = char.concentration?.isConcentrating
    ? char.concentration.spellName
    : undefined;

  if (conditions.length === 0 && diseases.length === 0 && !concentratingOn)
    return null;

  return (
    <Section level={3} heading="Conditions">
      <ul className="flex flex-wrap gap-1.5">
        {concentratingOn && (
          <li>
            <ConditionChip
              kind="concentration"
              name={`Concentrating on ${concentratingOn}`}
            />
          </li>
        )}
        {conditions.map((c, index) => (
          <li key={c.id || `${c.name}-${index}`}>
            <ConditionChip
              name={c.name}
              stackCount={c.stackable ? c.count : undefined}
            />
          </li>
        ))}
        {diseases.map((d, index) => (
          <li key={d.id || `${d.name}-${index}`}>
            <Badge variant="danger" size="sm">
              {d.name}
            </Badge>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function DefenseGroup({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="type-small text-muted mb-1">{label}</div>
      <div className="flex flex-wrap gap-1">
        {items.map(item => (
          <Badge key={item} variant="neutral" size="sm">
            {item}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function DefensesSection({ char }: { char: CharacterState }) {
  const resistances = ensureArray<string>(char.damageResistances);
  const immunities = ensureArray<string>(char.damageImmunities);
  const conditionImmunities = ensureArray<string>(char.conditionImmunities);

  if (
    resistances.length === 0 &&
    immunities.length === 0 &&
    conditionImmunities.length === 0
  )
    return null;

  return (
    <Section level={3} heading="Defenses">
      <div className="space-y-2">
        <DefenseGroup label="Resistances" items={resistances} />
        <DefenseGroup label="Damage immunities" items={immunities} />
        <DefenseGroup
          label="Condition immunities"
          items={conditionImmunities}
        />
      </div>
    </Section>
  );
}

function SensesSection({ char }: { char: CharacterState }) {
  const senses = ensureArray<(typeof char.senses)[number]>(char.senses);

  if (senses.length === 0) return null;

  return (
    <Section level={3} heading="Senses">
      <div className="flex flex-wrap gap-1.5">
        {senses.map((s, index) => (
          <Badge key={s.id || `${s.name}-${index}`} variant="neutral" size="sm">
            {s.name} {s.range} ft.
            {s.source && ` (${s.source})`}
          </Badge>
        ))}
      </div>
    </Section>
  );
}

function LanguagesSection({ char }: { char: CharacterState }) {
  const languages = ensureArray<(typeof char.languages)[number]>(char.languages)
    .filter(
      language => typeof language?.name === 'string' && language.name.trim()
    )
    .map(language => ({
      id: language.id,
      name: language.name.trim(),
      script:
        typeof language.script === 'string'
          ? language.script.trim()
          : undefined,
    }));

  if (languages.length === 0) return null;

  return (
    <Section level={3} heading="Languages">
      <div className="flex flex-wrap gap-1.5">
        {languages.map((language, index) => (
          <Badge
            key={language.id || `${language.name}-${index}`}
            variant="neutral"
            size="sm"
          >
            {language.name}
            {language.script && ` (${language.script})`}
          </Badge>
        ))}
      </div>
    </Section>
  );
}

function CurrencySection({ char }: { char: CharacterState }) {
  const c = char.currency;
  if (!c) return null;
  const coins = [
    { label: 'PP', value: c.platinum },
    { label: 'GP', value: c.gold },
    { label: 'EP', value: c.electrum },
    { label: 'SP', value: c.silver },
    { label: 'CP', value: c.copper },
  ].filter(coin => (coin.value ?? 0) > 0);

  if (coins.length === 0) return null;

  return (
    <Section level={3} heading="Currency">
      <p className="type-ui text-body flex flex-wrap gap-x-4">
        {coins.map(coin => (
          <span key={coin.label}>
            <span className="tabular-nums">{coin.value}</span> {coin.label}
          </span>
        ))}
      </p>
    </Section>
  );
}

function EncumbranceBadge({ status }: { status: EncumbranceInfo['status'] }) {
  switch (status) {
    case 'encumbered':
      return (
        <Badge variant="warning" size="sm">
          Encumbered
        </Badge>
      );
    case 'heavily-encumbered':
      return (
        <Badge variant="warning" size="sm">
          Heavily encumbered
        </Badge>
      );
    case 'over-capacity':
      return (
        <Badge variant="danger" size="sm">
          Over capacity
        </Badge>
      );
    default:
      return null;
  }
}

function getEncumbranceBarColor(status: EncumbranceInfo['status']): string {
  switch (status) {
    case 'encumbered':
    case 'heavily-encumbered':
      return 'bg-ember-fill';
    case 'over-capacity':
      return 'bg-blood-fill';
    default:
      return 'bg-divider-strong';
  }
}
