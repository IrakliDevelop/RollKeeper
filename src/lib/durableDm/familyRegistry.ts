import { calendarAdapter } from './adapters/calendarAdapter';
import { campaignSettingsAdapter } from './adapters/campaignSettingsAdapter';
import { combatLogArchiveAdapter } from './adapters/combatLogArchiveAdapter';
import { encounterAdapter } from './adapters/encounterAdapter';
import { magicItemAdapter } from './adapters/magicItemAdapter';
import { npcAdapter } from './adapters/npcAdapter';
import type {
  DurableFamilyAdapter,
  DurableFamilyName,
} from './durableFamilyAdapter';

/**
 * A registered family carries the real adapter that runs its chain. A
 * planned family is a registry row with no adapter at all: it renders as a
 * not-yet-available step that never runs (spec R6, R13). Bare `deliveries` /
 * `player_deliveries` are deliberately not members of either union member —
 * Player inbox is membership-dependent server queue state, not a
 * browser-owned `DurableFamilyAdapter` family, and is excluded from this
 * registry entirely (Registry section, design doc).
 */
export type RegistryEntry =
  | {
      status: 'registered';
      family: DurableFamilyName;
      label: string;
      adapter: DurableFamilyAdapter;
    }
  | { status: 'planned'; family: 'location' | 'battle_map'; label: string };

/**
 * Fixed order (Registry section, design doc):
 * campaign_settings -> calendar -> magic_item -> npc ->
 * encounter_definition -> combat_log_archive -> location -> battle_map.
 *
 * The first six are registered (Tasks 7-12 shipped their adapters). The last
 * two are planned: registry rows with no adapter. Player inbox is excluded
 * entirely, not merely unregistered — it does not share this registry's
 * recovery and local-authority chain.
 */
export const DURABLE_FAMILY_REGISTRY: readonly RegistryEntry[] = [
  {
    status: 'registered',
    family: 'campaign_settings',
    label: campaignSettingsAdapter.label,
    adapter: campaignSettingsAdapter,
  },
  {
    status: 'registered',
    family: 'calendar',
    label: calendarAdapter.label,
    adapter: calendarAdapter,
  },
  {
    status: 'registered',
    family: 'magic_item',
    label: magicItemAdapter.label,
    adapter: magicItemAdapter,
  },
  {
    status: 'registered',
    family: 'npc',
    label: npcAdapter.label,
    adapter: npcAdapter,
  },
  {
    status: 'registered',
    family: 'encounter_definition',
    label: encounterAdapter.label,
    adapter: encounterAdapter,
  },
  {
    status: 'registered',
    family: 'combat_log_archive',
    label: combatLogArchiveAdapter.label,
    adapter: combatLogArchiveAdapter,
  },
  { status: 'planned', family: 'location', label: 'Locations' },
  { status: 'planned', family: 'battle_map', label: 'Battle maps' },
];

/**
 * The six shipped adapters, regardless of each family's own client flag.
 * This is the R13 "registered" denominator: a disabled family still counts
 * here, which is what lets a disabled family block "All campaign data is
 * synced" even though it never runs.
 */
export function registeredAdapters(): DurableFamilyAdapter[] {
  return DURABLE_FAMILY_REGISTRY.filter(
    (entry): entry is Extract<RegistryEntry, { status: 'registered' }> =>
      entry.status === 'registered'
  ).map(entry => entry.adapter);
}

/**
 * The subset of registered adapters whose own client flag is currently on.
 * `isVisible()` reads its module-level flag live, so this reflects the
 * current environment on every call rather than a value captured once.
 */
export function enabledAdapters(): DurableFamilyAdapter[] {
  return registeredAdapters().filter(adapter => adapter.isVisible());
}
