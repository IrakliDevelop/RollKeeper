'use client';

import {
  Hand,
  MousePointer2,
  Pencil,
  MoveUpRight,
  Ruler,
  Circle,
  Eraser,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useActiveTool } from '@fieldnotes/react';

import { Button } from '@/components/ui/forms/button';

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
  tokenInfoToggle: { visible: boolean; onToggle: () => void };
}

/** Top-center tool pill for the DM battle-map canvas — structurally mirrors
 * `PlayerBattleMapCanvas`'s `PlayerToolbar`, minus the token tool (placed via
 * the roster in Task 8, never through this toolbar) plus a Clear-drawings
 * action. The connection-status chip lives solely in `DmVttTopBar` now (see
 * P7c) — this toolbar no longer duplicates it. */
export function DmVttToolbar({
  onClearDrawings,
  tokenInfoToggle,
}: DmVttToolbarProps) {
  const [activeTool, setTool] = useActiveTool();
  return (
    <div className="bg-surface-raised border-divider absolute top-16 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-xl border p-1 shadow-lg min-[1350px]:top-3">
      {DM_TOOLS.map(({ name, label, Icon }) => (
        <Button
          key={name}
          variant={activeTool === name ? 'primary' : 'ghost'}
          onClick={() => setTool(name)}
          className="min-h-[44px] min-w-[44px] p-0"
          title={label}
          aria-label={label}
        >
          <Icon size={16} />
        </Button>
      ))}
      <Button
        variant="ghost"
        onClick={onClearDrawings}
        className="min-h-[44px] min-w-[44px] p-0"
        title="Clear drawings"
        aria-label="Clear drawings"
      >
        <Eraser size={16} />
      </Button>
      <Button
        variant="ghost"
        onClick={tokenInfoToggle.onToggle}
        className="min-h-[44px] min-w-[44px] p-0"
        title={tokenInfoToggle.visible ? 'Hide token info' : 'Show token info'}
        aria-label={
          tokenInfoToggle.visible ? 'Hide token info' : 'Show token info'
        }
        aria-pressed={tokenInfoToggle.visible}
      >
        {tokenInfoToggle.visible ? <Eye size={16} /> : <EyeOff size={16} />}
      </Button>
    </div>
  );
}
