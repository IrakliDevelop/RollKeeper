'use client';

import React from 'react';
import {
  Heart,
  Shield,
  Zap,
  Swords,
  Weight,
  Sparkles,
  AlertTriangle,
  Angry,
  Gem,
  Scroll,
  Link2,
  Minus,
  Plus,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
} from '@/components/ui/feedback/dialog-new';
import { Badge } from '@/components/ui/layout/badge';
import { CampaignPlayerData } from '@/types/campaign';
import { CharacterState } from '@/types/character';
import { calculateEncumbrance, EncumbranceInfo } from '@/utils/encumbrance';
import { calculateModifier, getProficiencyBonus } from '@/utils/calculations';

interface PlayerDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  player: CampaignPlayerData;
  customCounterLabel?: string;
  counterValue?: number;
  onAdjustCounter?: (delta: number) => void;
}

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

function formatMod(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

function getHpColor(current: number, max: number): string {
  if (max === 0) return 'text-muted';
  const pct = current / max;
  if (pct > 0.5) return 'text-green-600 dark:text-green-400';
  if (pct > 0.25) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

function SectionTitle({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <h3 className="text-heading mb-2 flex items-center gap-2 text-sm font-semibold tracking-wide uppercase">
      {icon}
      {children}
    </h3>
  );
}

export function PlayerDetailDialog({
  open,
  onOpenChange,
  player,
  customCounterLabel,
  counterValue = 0,
  onAdjustCounter,
}: PlayerDetailDialogProps) {
  const char = player.characterData;
  if (!char) return null;

  const currentHp = char.hitPoints?.current ?? 0;
  const maxHp = char.hitPoints?.max ?? 0;
  const tempHp = char.hitPoints?.temporary ?? 0;
  const ac = char.isTempACActive
    ? (char.tempArmorClass ?? char.armorClass)
    : char.armorClass;
  const level = char.totalLevel || char.level || 1;
  const charClass = char.classes?.length
    ? char.classes.map(c => `${c.className} ${c.level}`).join(' / ')
    : `${char.class?.name || 'Unknown'} ${level}`;
  const profBonus = getProficiencyBonus(level);
  const encumbrance = calculateEncumbrance(char);
  const inspirationCount = char.heroicInspiration?.count ?? 0;
  const attunement = char.attunementSlots;
  const dexMod = calculateModifier(char.abilities?.dexterity ?? 10);
  const initBonus = char.initiative?.isOverridden
    ? char.initiative.value
    : dexMod;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>
            <span className="flex items-center gap-3">
              {char.name || player.characterName}
              <Badge variant="info" size="sm">
                {charClass}
              </Badge>
            </span>
          </DialogTitle>
          <p className="text-muted text-sm">
            {char.race || 'Unknown'} · {char.alignment || 'Unaligned'} · Player:{' '}
            {player.playerName}
          </p>
        </DialogHeader>

        <DialogBody>
          <div className="space-y-6">
            {/* ── Quick Stats Row ── */}
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
              <QuickStat
                label="HP"
                value={`${currentHp}/${maxHp}`}
                sub={tempHp > 0 ? `+${tempHp} temp` : undefined}
                color={getHpColor(currentHp, maxHp)}
                icon={<Heart size={14} />}
              />
              <QuickStat
                label="AC"
                value={String(ac)}
                sub={char.isTempACActive ? 'temp' : undefined}
                icon={<Shield size={14} />}
              />
              <QuickStat
                label="Speed"
                value={`${char.speed ?? 30}`}
                sub="ft."
                icon={<Zap size={14} />}
              />
              <QuickStat
                label="Initiative"
                value={formatMod(initBonus)}
                icon={<Swords size={14} />}
              />
              <QuickStat label="Prof." value={formatMod(profBonus)} />
              <QuickStat
                label="Inspiration"
                value={String(inspirationCount)}
                icon={
                  <Sparkles
                    size={14}
                    className={
                      inspirationCount > 0
                        ? 'text-accent-amber-text'
                        : 'text-faint'
                    }
                  />
                }
              />
            </div>

            {/* ── Inspiration & Custom Counter ── */}
            <div className="flex flex-wrap gap-3">
              {/* Inspiration — golden star boxes like character page */}
              <div
                className="border-accent-amber-border from-accent-amber-bg to-accent-amber-bg rounded-lg border-2 bg-gradient-to-br px-3 py-2"
                title="Heroic Inspiration — player can reroll and take the better result"
              >
                <div className="text-accent-amber-text mb-1 flex items-center gap-1.5 text-xs font-semibold">
                  <Sparkles size={12} className="fill-current" />
                  Heroic Inspiration
                </div>
                <div className="flex gap-1.5">
                  {Array.from(
                    { length: Math.max(inspirationCount, 3) },
                    (_, i) => {
                      const isActive = i < inspirationCount;
                      return (
                        <div
                          key={i}
                          className={`flex h-7 w-7 items-center justify-center rounded-lg border-2 transition-all ${
                            isActive
                              ? 'scale-110 border-yellow-600 bg-gradient-to-br from-yellow-400 to-yellow-600 text-white shadow-md'
                              : 'bg-surface-raised border-yellow-300 text-yellow-600 dark:border-yellow-600 dark:text-yellow-400'
                          }`}
                        >
                          <Sparkles
                            size={12}
                            className={isActive ? 'fill-current' : ''}
                          />
                        </div>
                      );
                    }
                  )}
                </div>
              </div>

              {/* Custom counter — colored boxes like hit dice */}
              {customCounterLabel && onAdjustCounter && (
                <div className="border-accent-purple-border from-accent-purple-bg to-accent-purple-bg rounded-lg border-2 bg-gradient-to-br px-3 py-2">
                  <div className="text-accent-purple-text mb-1 flex items-center justify-between gap-3 text-xs font-semibold">
                    <span className="flex items-center gap-1">
                      <Angry size={12} />
                      {customCounterLabel}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onAdjustCounter(-1)}
                        className="text-accent-purple-text hover:bg-surface-secondary rounded p-0.5 transition-colors"
                        disabled={counterValue <= 0}
                      >
                        <Minus size={12} />
                      </button>
                      <button
                        onClick={() => onAdjustCounter(1)}
                        className="text-accent-purple-text hover:bg-surface-secondary rounded p-0.5 transition-colors"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    {counterValue > 0 ? (
                      Array.from({ length: counterValue }, (_, i) => (
                        <div
                          key={i}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border-2 border-purple-500 bg-purple-500 text-white shadow-md"
                        >
                          <Angry size={14} />
                        </div>
                      ))
                    ) : (
                      <span className="text-accent-purple-text py-1 text-xs opacity-60">
                        None
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ── Ability Scores ── */}
            <div>
              <SectionTitle icon={<Gem size={14} />}>
                Ability Scores
              </SectionTitle>
              <div className="grid grid-cols-6 gap-2">
                {ABILITY_KEYS.map(key => {
                  const score = char.abilities?.[key] ?? 10;
                  const mod = calculateModifier(score);
                  const saveProf =
                    char.savingThrows?.[key]?.proficient ?? false;
                  return (
                    <div
                      key={key}
                      className="bg-surface-secondary rounded-lg p-2 text-center"
                    >
                      <div className="text-muted text-[10px] font-bold uppercase">
                        {ABILITY_LABELS[key]}
                      </div>
                      <div className="text-heading text-lg font-bold">
                        {score}
                      </div>
                      <div className="text-body text-xs">{formatMod(mod)}</div>
                      {saveProf && (
                        <div className="mt-0.5 text-[9px] text-green-600 dark:text-green-400">
                          Save ✓
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* ── Skills ── */}
              <div>
                <SectionTitle icon={<Scroll size={14} />}>Skills</SectionTitle>
                <div className="bg-surface-secondary rounded-lg p-3">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                    {SKILL_ENTRIES.map(({ key, ability }) => {
                      const skill =
                        char.skills?.[key as keyof typeof char.skills];
                      const isProficient = skill?.proficient ?? false;
                      const isExpertise = skill?.expertise ?? false;
                      const abilityScore =
                        char.abilities?.[
                          ability as keyof typeof char.abilities
                        ] ?? 10;
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
                        <div
                          key={key}
                          className="flex items-center justify-between py-0.5 text-xs"
                        >
                          <span className="text-body flex items-center gap-1">
                            {isExpertise && (
                              <span className="inline-block h-1.5 w-1.5 rounded-full bg-yellow-500" />
                            )}
                            {isProficient && !isExpertise && (
                              <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
                            )}
                            {!isProficient && !isExpertise && (
                              <span className="inline-block h-1.5 w-1.5 rounded-full bg-transparent" />
                            )}
                            {formatSkillName(key)}
                            <span className="text-faint">
                              ({ABILITY_LABELS[ability]})
                            </span>
                          </span>
                          <span className="text-heading font-medium tabular-nums">
                            {formatMod(totalMod)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* ── Right Column ── */}
              <div className="space-y-4">
                <ConditionsSection char={char} />

                {/* Encumbrance */}
                <div>
                  <SectionTitle icon={<Weight size={14} />}>
                    Encumbrance
                  </SectionTitle>
                  <div className="bg-surface-secondary rounded-lg p-3">
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="text-body">
                        {encumbrance.totalWeight} / {encumbrance.carryCapacity}{' '}
                        lbs
                      </span>
                      <EncumbranceBadge status={encumbrance.status} />
                    </div>
                    <div className="bg-surface h-2 w-full overflow-hidden rounded-full">
                      <div
                        className={`h-full rounded-full transition-all ${getEncumbranceBarColor(encumbrance.status)}`}
                        style={{
                          width: `${Math.min(100, (encumbrance.totalWeight / encumbrance.carryCapacity) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                <CurrencySection char={char} />

                {attunement && (
                  <div>
                    <SectionTitle icon={<Link2 size={14} />}>
                      Attunement
                    </SectionTitle>
                    <div className="text-body text-sm">
                      {attunement.used} / {attunement.max} slots used
                    </div>
                  </div>
                )}
              </div>
            </div>

            <SpellSlotsSection char={char} />
            <WeaponsSection char={char} />
            <MagicItemsSection char={char} />
            <ArmorSection char={char} />
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

// ── Subcomponents ──

function QuickStat({
  label,
  value,
  sub,
  color,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="bg-surface-secondary rounded-lg p-2 text-center">
      <div className="text-muted mb-0.5 text-[10px] font-bold uppercase">
        {label}
      </div>
      <div
        className={`flex items-center justify-center gap-1 text-lg font-bold ${color || 'text-heading'}`}
      >
        {icon}
        {value}
      </div>
      {sub && <div className="text-muted text-[10px]">{sub}</div>}
    </div>
  );
}

function ConditionsSection({ char }: { char: CharacterState }) {
  const conditions = char.conditionsAndDiseases?.activeConditions ?? [];
  const diseases = char.conditionsAndDiseases?.activeDiseases ?? [];
  const isConcentrating = char.concentration?.isConcentrating;

  if (conditions.length === 0 && diseases.length === 0 && !isConcentrating)
    return null;

  return (
    <div>
      <SectionTitle icon={<AlertTriangle size={14} />}>Status</SectionTitle>
      <div className="flex flex-wrap gap-1.5">
        {isConcentrating && char.concentration?.spellName && (
          <Badge variant="info" size="sm">
            <Sparkles size={10} className="mr-1" />
            {char.concentration.spellName}
          </Badge>
        )}
        {conditions.map(c => (
          <Badge key={c.id} variant="warning" size="sm">
            {c.name}
            {c.stackable && c.count > 1 && ` ×${c.count}`}
          </Badge>
        ))}
        {diseases.map(d => (
          <Badge key={d.id} variant="danger" size="sm">
            {d.name}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function CurrencySection({ char }: { char: CharacterState }) {
  const c = char.currency;
  if (!c) return null;
  const coins = [
    { label: 'PP', value: c.platinum, color: 'text-blue-300' },
    { label: 'GP', value: c.gold, color: 'text-yellow-500' },
    { label: 'EP', value: c.electrum, color: 'text-gray-400' },
    { label: 'SP', value: c.silver, color: 'text-gray-300' },
    { label: 'CP', value: c.copper, color: 'text-orange-400' },
  ].filter(coin => (coin.value ?? 0) > 0);

  if (coins.length === 0) return null;

  return (
    <div>
      <SectionTitle icon={<span className="text-xs">$</span>}>
        Currency
      </SectionTitle>
      <div className="flex flex-wrap gap-3">
        {coins.map(coin => (
          <span key={coin.label} className="text-body text-sm">
            <span className={`font-bold ${coin.color}`}>{coin.value}</span>{' '}
            {coin.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function SpellSlotsSection({ char }: { char: CharacterState }) {
  const slots = char.spellSlots;
  if (!slots) return null;

  const levels = Object.entries(slots).filter(
    ([, data]) => data && data.max > 0
  );
  if (levels.length === 0) return null;

  return (
    <div>
      <SectionTitle icon={<Sparkles size={14} />}>Spell Slots</SectionTitle>
      <div className="flex flex-wrap gap-3">
        {levels.map(([level, data]) => {
          const remaining = data.max - data.used;
          const allSpent = remaining === 0;
          return (
            <div
              key={level}
              className={`rounded-lg px-3 py-2 text-center ${
                allSpent
                  ? 'bg-accent-red-bg border-accent-red-border border'
                  : 'bg-surface-secondary'
              }`}
            >
              <div className="text-muted mb-1 text-[10px] font-bold">
                Lv {level}
              </div>
              <div className="flex items-center justify-center gap-1">
                {Array.from({ length: data.max }, (_, i) => {
                  const isFilled = i < remaining;
                  return (
                    <div
                      key={i}
                      className={`h-3 w-3 rounded-full border ${
                        isFilled
                          ? 'border-accent-blue-border bg-accent-blue-text'
                          : 'border-accent-red-border bg-accent-red-bg'
                      }`}
                      title={isFilled ? 'Available' : 'Spent'}
                    />
                  );
                })}
              </div>
              <div
                className={`mt-1 text-[10px] font-medium ${
                  allSpent ? 'text-accent-red-text' : 'text-muted'
                }`}
              >
                {remaining}/{data.max}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeaponsSection({ char }: { char: CharacterState }) {
  const weapons = char.weapons;
  if (!weapons || weapons.length === 0) return null;

  return (
    <div>
      <SectionTitle icon={<Swords size={14} />}>Weapons</SectionTitle>
      <div className="space-y-1.5">
        {weapons.map(w => (
          <div
            key={w.id}
            className="bg-surface-secondary flex items-center justify-between rounded-lg px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <span
                className={`text-sm font-medium ${w.isEquipped ? 'text-heading' : 'text-muted'}`}
              >
                {w.name}
              </span>
              {w.isEquipped && (
                <Badge variant="success" size="sm">
                  Equipped
                </Badge>
              )}
              {w.isAttuned && (
                <Badge variant="info" size="sm">
                  Attuned
                </Badge>
              )}
            </div>
            <span className="text-muted text-xs">
              {w.damage?.map(d => `${d.dice} ${d.type}`).join(', ')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MagicItemsSection({ char }: { char: CharacterState }) {
  const items = char.magicItems;
  if (!items || items.length === 0) return null;

  return (
    <div>
      <SectionTitle icon={<Gem size={14} />}>Magic Items</SectionTitle>
      <div className="space-y-1.5">
        {items.map(item => (
          <div
            key={item.id}
            className="bg-surface-secondary flex items-center justify-between rounded-lg px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <span className="text-heading text-sm font-medium">
                {item.name}
              </span>
              {item.rarity && <RarityBadge rarity={item.rarity} />}
              {item.isAttuned && (
                <Badge variant="info" size="sm">
                  Attuned
                </Badge>
              )}
              {item.isEquipped && (
                <Badge variant="success" size="sm">
                  Equipped
                </Badge>
              )}
            </div>
            {item.chargePool && (
              <span className="text-muted text-xs">
                {item.chargePool.maxCharges - item.chargePool.usedCharges}/
                {item.chargePool.maxCharges} charges
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ArmorSection({ char }: { char: CharacterState }) {
  const armor = char.armorItems;
  if (!armor || armor.length === 0) return null;

  return (
    <div>
      <SectionTitle icon={<Shield size={14} />}>Armor</SectionTitle>
      <div className="space-y-1.5">
        {armor.map(a => (
          <div
            key={a.id}
            className="bg-surface-secondary flex items-center justify-between rounded-lg px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <span
                className={`text-sm font-medium ${a.isEquipped ? 'text-heading' : 'text-muted'}`}
              >
                {a.name}
              </span>
              {a.isEquipped && (
                <Badge variant="success" size="sm">
                  Equipped
                </Badge>
              )}
              <span className="text-muted text-xs capitalize">
                {a.category}
              </span>
            </div>
            <span className="text-body text-sm font-medium">
              AC {a.baseAC + (a.enhancementBonus ?? 0)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RarityBadge({ rarity }: { rarity: string }) {
  const variantMap: Record<
    string,
    'neutral' | 'success' | 'info' | 'warning' | 'danger' | 'primary'
  > = {
    common: 'neutral',
    uncommon: 'success',
    rare: 'info',
    'very rare': 'warning',
    legendary: 'danger',
    artifact: 'primary',
  };
  return (
    <Badge variant={variantMap[rarity] ?? 'neutral'} size="sm">
      {rarity}
    </Badge>
  );
}

function EncumbranceBadge({ status }: { status: EncumbranceInfo['status'] }) {
  const config: Record<
    string,
    { variant: 'success' | 'warning' | 'danger' | 'neutral'; label: string }
  > = {
    normal: { variant: 'success', label: 'Normal' },
    encumbered: { variant: 'warning', label: 'Encumbered' },
    'heavily-encumbered': { variant: 'danger', label: 'Heavily Encumbered' },
    'over-capacity': { variant: 'danger', label: 'Over Capacity' },
  };
  const { variant, label } = config[status] ?? config.normal;
  return (
    <Badge variant={variant} size="sm">
      {label}
    </Badge>
  );
}

function getEncumbranceBarColor(status: EncumbranceInfo['status']): string {
  switch (status) {
    case 'normal':
      return 'bg-green-500';
    case 'encumbered':
      return 'bg-yellow-500';
    case 'heavily-encumbered':
    case 'over-capacity':
      return 'bg-red-500';
    default:
      return 'bg-green-500';
  }
}
