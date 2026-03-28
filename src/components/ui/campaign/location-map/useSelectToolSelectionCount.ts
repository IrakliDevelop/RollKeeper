'use client';

import * as React from 'react';
import { SelectTool } from '@fieldnotes/core';
import { useViewport } from '@fieldnotes/react';

/**
 * Selection updates do not always emit store events; mirror pointer + tool listeners.
 */
export function useSelectToolSelectionCount() {
  const viewport = useViewport();
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    const bump = () => setTick(t => t + 1);
    const wrapper = viewport.domLayer.parentElement;
    if (wrapper) {
      wrapper.addEventListener('pointerdown', bump, { passive: true });
      wrapper.addEventListener('pointerup', bump, { passive: true });
      wrapper.addEventListener('pointercancel', bump, { passive: true });
    }
    const u1 = viewport.toolManager.onChange(bump);
    const u2 = viewport.store.onChange(bump);
    return () => {
      if (wrapper) {
        wrapper.removeEventListener('pointerdown', bump);
        wrapper.removeEventListener('pointerup', bump);
        wrapper.removeEventListener('pointercancel', bump);
      }
      u1();
      u2();
    };
  }, [viewport]);

  return React.useMemo(() => {
    void tick;
    if (viewport.toolManager.activeTool?.name !== 'select') return 0;
    const selectTool = viewport.toolManager.getTool<SelectTool>('select');
    if (!selectTool) return 0;
    return selectTool.selectedIds.filter(id => viewport.store.getById(id))
      .length;
  }, [viewport, tick]);
}
