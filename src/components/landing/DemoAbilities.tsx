import { Medallion } from '@/components/ui/game/Medallion';
import { calculateModifier } from '@/utils/calculations';
import { ABILITY_NAMES } from '@/utils/constants';
import type { AbilityName } from '@/types/character';
import type { DemoSheetState } from './sampleCharacter';

const ABILITIES = Object.keys(ABILITY_NAMES) as AbilityName[];

interface DemoAbilitiesProps {
  abilities: DemoSheetState['abilities'];
  saveProficient: AbilityName[];
}

/** Six read-only medallions, each named below; hidden on phones. */
export function DemoAbilities({
  abilities,
  saveProficient,
}: DemoAbilitiesProps) {
  return (
    <ul className="hidden grid-cols-3 gap-x-2 gap-y-4 sm:grid md:grid-cols-6">
      {ABILITIES.map(ability => (
        <li key={ability} className="flex flex-col items-center gap-4">
          <Medallion
            ability={ability}
            score={abilities[ability]}
            modifier={calculateModifier(abilities[ability])}
            saveProficient={saveProficient.includes(ability)}
            abilityDisplay="modifier"
          />
          <span className="type-caption text-muted">
            {ABILITY_NAMES[ability]}
          </span>
        </li>
      ))}
    </ul>
  );
}
