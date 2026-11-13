import {
  Eraser,
  Flag,
  Footprints,
  Hand,
  Image as ImageIcon,
  CircleDashed,
  CloudFog,
  MapPin,
  MousePointer2,
  MoveUpRight,
  Pencil,
  Ruler,
  Shapes,
  StickyNote,
  Type,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { MARKER_TOOL_NAME } from './DmMarkerTool';

export interface MapToolMeta {
  label: string;
  Icon: LucideIcon;
}

/**
 * One vocabulary for every DM map tool: the label and glyph the setup toolbar,
 * the VTT dock and the options row all show for a tool name. A tool without an
 * entry (the player's `token`) has no name cell.
 */
export const MAP_TOOL_META: Readonly<Partial<Record<string, MapToolMeta>>> = {
  hand: { label: 'Pan', Icon: Hand },
  select: { label: 'Select', Icon: MousePointer2 },
  pencil: { label: 'Draw', Icon: Pencil },
  text: { label: 'Text', Icon: Type },
  note: { label: 'Sticky note', Icon: StickyNote },
  shape: { label: 'Shape', Icon: Shapes },
  image: { label: 'Image', Icon: ImageIcon },
  arrow: { label: 'Arrow', Icon: MoveUpRight },
  [MARKER_TOOL_NAME]: { label: 'Marker', Icon: Flag },
  measure: { label: 'Measure', Icon: Ruler },
  path: { label: 'Move', Icon: Footprints },
  template: { label: 'Template', Icon: CircleDashed },
  eraser: { label: 'Eraser', Icon: Eraser },
  laser: { label: 'Laser pointer', Icon: Zap },
  ping: { label: 'Ping', Icon: MapPin },
  fog: { label: 'Fog of war', Icon: CloudFog },
};

/** Build ordered tool defs from tool names; throws on a name with no entry. */
export function mapToolDefs(
  names: readonly string[]
): { name: string; label: string; Icon: LucideIcon }[] {
  return names.map(name => {
    const meta = MAP_TOOL_META[name];
    if (!meta) throw new Error(`No MAP_TOOL_META entry for tool "${name}"`);
    return { name, label: meta.label, Icon: meta.Icon };
  });
}
