'use client';

import {
  Hand,
  MousePointer2,
  Pencil,
  MoveUpRight,
  Ruler,
  Circle,
  Type,
  StickyNote,
  Shapes,
  Eraser,
  Scissors,
  Eye,
  Minus,
  EyeOff,
  Zap,
} from 'lucide-react';
import { useActiveTool } from '@fieldnotes/react';

import { Button } from '@/components/ui/forms/button';

import type { TokenInfoMode } from '@/components/ui/campaign/token-overlay';

const DM_TOOLS: { name: string; label: string; Icon: typeof Hand }[] = [
  { name: 'hand', label: 'Pan', Icon: Hand },
  { name: 'select', label: 'Select', Icon: MousePointer2 },
  { name: 'pencil', label: 'Draw', Icon: Pencil },
  { name: 'arrow', label: 'Arrow', Icon: MoveUpRight },
  { name: 'shape', label: 'Shape', Icon: Shapes },
  { name: 'text', label: 'Text', Icon: Type },
  { name: 'note', label: 'Sticky Note', Icon: StickyNote },
  { name: 'measure', label: 'Measure', Icon: Ruler },
  { name: 'template', label: 'Template', Icon: Circle },
  { name: 'eraser', label: 'Eraser', Icon: Eraser },
  { name: 'laser', label: 'Laser pointer', Icon: Zap },
];

export interface DmVttToolbarProps {
  onClearDrawings: () => void;
  tokenInfoToggle: { mode: TokenInfoMode | null; onCycle: () => void };
  hiddenPlacementActive: boolean;
  onToggleHiddenPlacement: () => void;
  hiddenElementCount: number;
  onRevealAll: () => void;
  selectedElementId: string | null;
  selectedElementIsDmOnly: boolean;
  onToggleSelectedDmOnly: () => void;
}

const TOKEN_INFO_ICON: Record<TokenInfoMode, typeof Eye> = {
  full: Eye,
  compact: Minus,
  off: EyeOff,
};

const TOKEN_INFO_LABEL: Record<TokenInfoMode, string> = {
  full: 'Token info: full',
  compact: 'Token info: compact',
  off: 'Token info: hidden',
};

/** Top-center tool pill for the DM battle-map canvas — structurally mirrors
 * `PlayerBattleMapCanvas`'s `PlayerToolbar`, minus the token tool (placed via
 * the roster in Task 8, never through this toolbar) plus a Clear-drawings
 * action. The connection-status chip lives solely in `DmVttTopBar` now (see
 * P7c) — this toolbar no longer duplicates it. */
export function DmVttToolbar({
  onClearDrawings,
  tokenInfoToggle,
  hiddenPlacementActive,
  onToggleHiddenPlacement,
  hiddenElementCount,
  onRevealAll,
  selectedElementId,
  selectedElementIsDmOnly,
  onToggleSelectedDmOnly,
}: DmVttToolbarProps) {
  const [activeTool, setTool] = useActiveTool();
  const TokenInfoIcon = TOKEN_INFO_ICON[tokenInfoToggle.mode ?? 'compact'];
  return (
    <div className="bg-surface-raised border-divider absolute top-20 left-1/2 z-10 flex max-w-[94vw] -translate-x-1/2 items-center gap-3 overflow-x-auto rounded-xl border p-1 shadow-lg">
      <div className="flex items-center gap-1">
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
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant={hiddenPlacementActive ? 'warning' : 'ghost'}
          onClick={onToggleHiddenPlacement}
          className="min-h-[44px] px-2"
          title={
            hiddenPlacementActive
              ? 'New elements are hidden from players'
              : 'New elements are visible to players'
          }
          aria-label="Place hidden elements"
          aria-pressed={hiddenPlacementActive}
        >
          <EyeOff size={16} />
          <span className="ml-1.5 hidden text-xs xl:inline">
            {hiddenPlacementActive ? 'Placing hidden' : 'Place hidden'}
          </span>
        </Button>
        <Button
          variant="ghost"
          onClick={onRevealAll}
          disabled={hiddenElementCount === 0}
          className="min-h-[44px] px-2"
          title={
            hiddenElementCount === 0
              ? 'No hidden elements to reveal'
              : `Reveal all ${hiddenElementCount} hidden element${hiddenElementCount === 1 ? '' : 's'}`
          }
          aria-label={`Reveal all hidden elements (${hiddenElementCount})`}
        >
          <Eye size={16} />
          <span className="ml-1.5 hidden text-xs xl:inline">
            Reveal all ({hiddenElementCount})
          </span>
        </Button>
        {selectedElementId && (
          <Button
            variant={selectedElementIsDmOnly ? 'warning' : 'ghost'}
            onClick={onToggleSelectedDmOnly}
            className="min-h-[44px] px-2"
            title={
              selectedElementIsDmOnly
                ? 'Reveal selected element to players'
                : 'Hide selected element from players'
            }
            aria-label={
              selectedElementIsDmOnly
                ? 'Reveal selected element'
                : 'Hide selected element'
            }
          >
            {selectedElementIsDmOnly ? <Eye size={16} /> : <EyeOff size={16} />}
          </Button>
        )}
        <Button
          variant="ghost"
          onClick={onClearDrawings}
          className="min-h-[44px] min-w-[44px] p-0"
          title="Clear drawings"
          aria-label="Clear drawings"
        >
          <Scissors size={16} />
        </Button>
        <Button
          variant="ghost"
          onClick={tokenInfoToggle.onCycle}
          className="min-h-[44px] min-w-[44px] p-0"
          title={TOKEN_INFO_LABEL[tokenInfoToggle.mode ?? 'compact']}
          aria-label={TOKEN_INFO_LABEL[tokenInfoToggle.mode ?? 'compact']}
        >
          <TokenInfoIcon size={16} />
        </Button>
      </div>
    </div>
  );
}
