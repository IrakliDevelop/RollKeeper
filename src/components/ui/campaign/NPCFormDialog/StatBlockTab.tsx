'use client';

import type { CustomCondition } from '@/types/encounter';
import { useEncounterStore } from '@/store/encounterStore';
import { useOfficialConditions } from '@/hooks/useOfficialConditions';
import { EMPTY_CUSTOM_CONDITIONS } from '@/utils/customConditions';
import { AbilityListEditor } from '../AbilityListEditor';
import { NpcResourcesEditor } from '../NpcResourcesEditor';
import { NpcInflictsEditor } from '../NpcInflictsEditor';
import { AbilityScoresSection } from './AbilityScoresSection';
import { DefensesSection } from './DefensesSection';
import {
  ChallengeSection,
  HitDiceSection,
  PassiveScoresSection,
} from './StatBlockNumbers';
import type {
  NpcDerivedFields,
  NpcFormDraft,
  NpcFormUpdate,
} from './npcFormDraft';

interface StatBlockTabProps {
  draft: NpcFormDraft;
  update: NpcFormUpdate;
  derived: NpcDerivedFields;
  onDeleteResource: (id: string) => void;
}

export function StatBlockTab({
  draft,
  update,
  derived,
  onDeleteResource,
}: StatBlockTabProps) {
  const { conditions: officialConditions, loading: officialConditionsLoading } =
    useOfficialConditions();

  // Condition library
  const conditionLibrary = useEncounterStore(
    state => state.combatConfig.customConditions ?? EMPTY_CUSTOM_CONDITIONS
  );
  const setCombatConfig = useEncounterStore(state => state.setCombatConfig);

  const handleCreateConditionInLibrary = (condition: CustomCondition) => {
    setCombatConfig({ customConditions: [...conditionLibrary, condition] });
  };

  return (
    <>
      <AbilityScoresSection draft={draft} update={update} />
      <ChallengeSection draft={draft} update={update} derived={derived} />
      <PassiveScoresSection update={update} derived={derived} />
      <HitDiceSection draft={draft} update={update} />
      <DefensesSection draft={draft} update={update} />
      <NpcInflictsEditor
        conditions={draft.inflictableConditions}
        library={conditionLibrary}
        officialConditions={officialConditions}
        officialConditionsLoading={officialConditionsLoading}
        onChange={inflictableConditions => update({ inflictableConditions })}
        onCreateInLibrary={handleCreateConditionInLibrary}
      />

      <NpcResourcesEditor
        resources={draft.resources}
        onChange={resources => update({ resources })}
        onDeleteResource={onDeleteResource}
      />

      <AbilityListEditor
        section="traits"
        items={draft.traits}
        onChange={traits => update({ traits })}
        resources={draft.resources}
        inventoryItems={draft.inventoryItems}
      />
      <AbilityListEditor
        section="actions"
        items={draft.actions}
        onChange={actions => update({ actions })}
        resources={draft.resources}
        inventoryItems={draft.inventoryItems}
      />
      <AbilityListEditor
        section="bonusActions"
        items={draft.bonusActions}
        onChange={bonusActions => update({ bonusActions })}
        resources={draft.resources}
        inventoryItems={draft.inventoryItems}
      />
      <AbilityListEditor
        section="reactions"
        items={draft.reactions}
        onChange={reactions => update({ reactions })}
        resources={draft.resources}
        inventoryItems={draft.inventoryItems}
      />
      <AbilityListEditor
        section="lairActions"
        items={draft.lairActions}
        onChange={lairActions => update({ lairActions })}
        resources={draft.resources}
        inventoryItems={draft.inventoryItems}
      />
    </>
  );
}
