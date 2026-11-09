'use client';

import { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import {
  Hand,
  MousePointer2,
  Pencil,
  MoveUpRight,
  Ruler,
  Footprints,
  Circle,
  Type,
  StickyNote,
  Shapes,
  Eraser,
  Image as ImageIcon,
  Zap,
  MapPin,
  Flag,
  CloudFog,
  ChevronDown,
} from 'lucide-react';
import { useActiveTool } from '@fieldnotes/react';
import { Button } from '@/components/ui/forms/button';
import { OVERLAY_SURFACE } from '@/components/ui/primitives/variants';
import type { DmFogControls } from '@/components/ui/campaign/location-map/fog';
import { MARKER_TOOL_NAME } from '@/components/ui/campaign/location-map/DmMarkerTool';

const NAVIGATION = [
  { name: 'select', label: 'Select', Icon: MousePointer2 },
  { name: 'hand', label: 'Pan', Icon: Hand },
];
const PLAY = [
  { name: 'path', label: 'Move', Icon: Footprints },
  { name: 'measure', label: 'Measure', Icon: Ruler },
  { name: 'template', label: 'Template', Icon: Circle },
];
const POINTERS = [
  { name: 'laser', label: 'Laser pointer', caption: 'Laser', Icon: Zap },
  { name: 'ping', label: 'Ping (look here)', caption: 'Ping', Icon: MapPin },
];
const DRAWING = [
  { name: 'pencil', label: 'Draw', Icon: Pencil },
  { name: 'arrow', label: 'Arrow', Icon: MoveUpRight },
  { name: 'shape', label: 'Shape', Icon: Shapes },
  { name: 'text', label: 'Text', Icon: Type },
  { name: 'note', label: 'Sticky note', Icon: StickyNote },
  { name: MARKER_TOOL_NAME, label: 'Marker', Icon: Flag },
  { name: 'eraser', label: 'Eraser', Icon: Eraser },
];

/** The complete tool union, including tools offered in the Drawing picker. */
export const DM_VTT_TOOL_NAMES: readonly string[] = [
  ...NAVIGATION,
  ...PLAY,
  ...DRAWING,
  ...POINTERS,
].map(tool => tool.name);
export function dmVttToolLabel(name: string | null) {
  return (
    [...NAVIGATION, ...PLAY, ...DRAWING, ...POINTERS].find(
      tool => tool.name === name
    )?.label ?? (name === 'fog' ? 'Fog' : 'Tool')
  );
}

export function DmVttToolStrip({
  hiddenTools,
  onPickImage,
  fogControls,
}: {
  hiddenTools?: readonly string[];
  onPickImage?: () => void;
  fogControls?: DmFogControls;
}) {
  const [activeTool, setTool] = useActiveTool();
  const [drawingOpen, setDrawingOpen] = useState(false);
  const available = <T extends { name: string }>(tools: T[]) =>
    tools.filter(tool => !hiddenTools?.includes(tool.name));
  const drawing = available(DRAWING);
  const current = drawing.find(tool => tool.name === activeTool);
  const DrawingIcon = current?.Icon ?? Pencil;
  const renderTool = ({
    name,
    label,
    Icon,
    caption,
  }: (typeof NAVIGATION)[number] & { caption?: string }) => (
    <Button
      key={name}
      variant="ghost"
      size="sm"
      selected={activeTool === name}
      aria-pressed={activeTool === name}
      aria-label={label}
      title={label}
      onClick={() => setTool(name)}
      className="type-caption h-auto min-h-11 min-w-11 shrink-0 flex-col gap-1 px-2 py-1"
    >
      <Icon size={16} aria-hidden />
      {caption ?? label}
    </Button>
  );
  return (
    <div
      className="scrollbar-thin flex min-w-0 flex-1 items-center gap-2 overflow-x-auto overscroll-x-contain p-2"
      role="group"
      aria-label="Map tools"
    >
      <div className="flex shrink-0 gap-1">
        {available(NAVIGATION).map(renderTool)}
      </div>
      <div className="border-divider flex shrink-0 gap-1 border-l pl-2">
        {available(PLAY).map(renderTool)}
      </div>
      {fogControls && !hiddenTools?.includes('fog') && (
        <Button
          variant="ghost"
          size="sm"
          selected={activeTool === 'fog'}
          aria-pressed={activeTool === 'fog'}
          onClick={fogControls.requestActivate}
          disabled={fogControls.disabled}
          title={fogControls.disabledReason ?? 'Fog of war'}
          aria-label="Fog of war"
          aria-describedby={
            fogControls.disabledReason ? 'dm-fog-disabled-reason' : undefined
          }
          className="type-caption h-auto min-h-11 min-w-11 shrink-0 flex-col gap-1 px-2 py-1"
        >
          <CloudFog size={16} aria-hidden />
          Fog
        </Button>
      )}
      {(drawing.length > 0 || onPickImage) && (
        <Popover.Root open={drawingOpen} onOpenChange={setDrawingOpen}>
          <Popover.Trigger asChild>
            <Button
              variant="ghost"
              size="sm"
              selected={!!current}
              aria-label={current ? `Drawing: ${current.label}` : 'Drawing'}
              className="type-caption h-auto min-h-11 shrink-0 flex-col gap-1 px-2 py-1"
            >
              <span className="flex items-center gap-1">
                <DrawingIcon size={16} aria-hidden />
                <ChevronDown size={12} aria-hidden />
              </span>
              {current?.label ?? 'Drawing'}
            </Button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              sideOffset={8}
              collisionPadding={8}
              aria-label="Drawing tools"
              className={`${OVERLAY_SURFACE} z-50 w-64 max-w-[calc(100vw-1rem)] overflow-y-auto p-3`}
              style={{
                maxHeight: 'var(--radix-popover-content-available-height)',
              }}
            >
              <p className="type-label-heading text-heading mb-2">
                Drawing tools
              </p>
              <div className="grid grid-cols-2 gap-1">
                {onPickImage && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="min-h-11 justify-start px-2"
                    onClick={() => {
                      onPickImage();
                      setDrawingOpen(false);
                    }}
                  >
                    <ImageIcon size={16} aria-hidden />
                    Image
                  </Button>
                )}
                {drawing.map(({ name, label, Icon }) => (
                  <Button
                    key={name}
                    variant="ghost"
                    size="sm"
                    selected={activeTool === name}
                    aria-pressed={activeTool === name}
                    onClick={() => {
                      setTool(name);
                      setDrawingOpen(false);
                    }}
                    className="min-h-11 justify-start px-2"
                  >
                    <Icon size={16} aria-hidden />
                    {label}
                  </Button>
                ))}
              </div>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      )}
      <div className="border-divider flex shrink-0 gap-1 border-l pl-2">
        {available(POINTERS).map(renderTool)}
      </div>
    </div>
  );
}
