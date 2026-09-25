'use client';

import React from 'react';

import { DetailEffects } from '@/components/ui/encounter/combat-screen/detail/DetailEffects';

import type { CreatureTabProps } from '../CreatureDrawer.utils';

/** Effects tab: active conditions/buffs and the condition/buff palette, unchanged from the panel. */
export function EffectsTab({ entity, actions }: CreatureTabProps) {
  return <DetailEffects entity={entity} actions={actions} />;
}
