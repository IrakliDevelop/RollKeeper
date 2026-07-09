'use client';

import {
  Hand,
  MousePointer2,
  Pencil,
  MoveUpRight,
  Ruler,
  Circle,
  Eraser,
} from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { useActiveTool } from '@fieldnotes/react';
import type { BattleMapConnectionStatus } from '@/lib/battlemapSync';

const DM_TOOLS: { name: string; label: string; Icon: typeof Hand }[] = [
  { name: 'hand', label: 'Pan', Icon: Hand },
  { name: 'select', label: 'Select', Icon: MousePointer2 },
  { name: 'pencil', label: 'Draw', Icon: Pencil },
  { name: 'arrow', label: 'Arrow', Icon: MoveUpRight },
  { name: 'measure', label: 'Measure', Icon: Ruler },
  { name: 'template', label: 'Template', Icon: Circle },
];

export interface DmVttToolbarProps {
  status: BattleMapConnectionStatus;
  onClearDrawings: () => void;
}

/** Top-center tool pill for the DM battle-map canvas — structurally mirrors
 * `PlayerBattleMapCanvas`'s `PlayerToolbar`, minus the token tool (placed via
 * the roster in Task 8, never through this toolbar) plus a Clear-drawings
 * action. */
export function DmVttToolbar({ status, onClearDrawings }: DmVttToolbarProps) {
  const [activeTool, setTool] = useActiveTool();
  return (
    <div className="bg-surface-raised border-divider absolute top-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-xl border p-1 shadow-lg">
      {DM_TOOLS.map(({ name, label, Icon }) => (
        <Button
          key={name}
          variant={activeTool === name ? 'primary' : 'ghost'}
          onClick={() => setTool(name)}
          className="h-8 w-8 p-0"
          title={label}
          aria-label={label}
        >
          <Icon size={16} />
        </Button>
      ))}
      <Button
        variant="ghost"
        onClick={onClearDrawings}
        className="h-8 w-8 p-0"
        title="Clear drawings"
        aria-label="Clear drawings"
      >
        <Eraser size={16} />
      </Button>
      <span
        className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
          status === 'live'
            ? 'bg-accent-emerald-bg text-accent-emerald-text'
            : status === 'denied'
              ? 'bg-accent-red-bg text-accent-red-text'
              : 'bg-accent-amber-bg text-accent-amber-text'
        }`}
      >
        {status === 'live'
          ? 'Live'
          : status === 'denied'
            ? 'Access denied'
            : 'Connecting…'}
      </span>
    </div>
  );
}
