'use client';

import { useEffect, useState } from 'react';

import { loadAllConditions } from '@/utils/conditionsDiseasesLoader';
import { buildOfficialConditions } from '@/utils/officialConditions';

import type { CustomCondition } from '@/types/encounter';

interface OfficialConditionsState {
  conditions: CustomCondition[];
  loading: boolean;
}

const INITIAL_STATE: OfficialConditionsState = {
  conditions: [],
  loading: true,
};

/** Loads canonical condition definitions once and ignores late unmount results. */
export function useOfficialConditions(): OfficialConditionsState {
  const [state, setState] = useState(INITIAL_STATE);

  useEffect(() => {
    let active = true;
    loadAllConditions().then(conditions => {
      if (active) {
        setState({
          conditions: buildOfficialConditions(conditions),
          loading: false,
        });
      }
    });
    return () => {
      active = false;
    };
  }, []);

  return state;
}
