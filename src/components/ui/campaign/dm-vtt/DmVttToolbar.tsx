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
  Minus,
  EyeOff,
} from 'lucide-react';
import { useActiveTool } from '@fieldnotes/react';

import { Button } from '@/components/ui/forms/button';

import type { TokenInfoMode } from '@/components/ui/campaign/token-overlay';

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
  tokenInfoToggle: { mode: TokenInfoMode | null; onCycle: () => void };
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
}: DmVttToolbarProps) {
  const [activeTool, setTool] = useActiveTool();
  const TokenInfoIcon = TOKEN_INFO_ICON[tokenInfoToggle.mode ?? 'compact'];
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
        onClick={tokenInfoToggle.onCycle}
        className="min-h-[44px] min-w-[44px] p-0"
        title={TOKEN_INFO_LABEL[tokenInfoToggle.mode ?? 'compact']}
        aria-label={TOKEN_INFO_LABEL[tokenInfoToggle.mode ?? 'compact']}
      >
        <TokenInfoIcon size={16} />
      </Button>
    </div>
  );
}
