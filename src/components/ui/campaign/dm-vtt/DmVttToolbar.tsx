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

const DM_TOOLS: { name: string; label: string; Icon: typeof Hand }[] = [
  { name: 'hand', label: 'Pan', Icon: Hand },
  { name: 'select', label: 'Select', Icon: MousePointer2 },
  { name: 'pencil', label: 'Draw', Icon: Pencil },
  { name: 'arrow', label: 'Arrow', Icon: MoveUpRight },
  { name: 'measure', label: 'Measure', Icon: Ruler },
  { name: 'template', label: 'Template', Icon: Circle },
];

export interface DmVttToolbarProps {
  onClearDrawings: () => void;
}

/** Top-center tool pill for the DM battle-map canvas — structurally mirrors
 * `PlayerBattleMapCanvas`'s `PlayerToolbar`, minus the token tool (placed via
 * the roster in Task 8, never through this toolbar) plus a Clear-drawings
 * action. The connection-status chip lives solely in `DmVttTopBar` now (see
 * P7c) — this toolbar no longer duplicates it. */
export function DmVttToolbar({ onClearDrawings }: DmVttToolbarProps) {
  const [activeTool, setTool] = useActiveTool();
  return (
    <div className="bg-surface-raised border-divider absolute top-16 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-xl border p-1 shadow-lg min-[1350px]:top-3">
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
    </div>
  );
}
