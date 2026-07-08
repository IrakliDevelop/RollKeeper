import type { Tool, PointerState, ToolContext } from '@fieldnotes/core';
import type { AoeShape } from '@/types/spellAoe';

export interface SpellTemplateConfig {
  shape: AoeShape;
  sizeFeet: number;
  widthFeet?: number;
  /** Called once after the template lands (tool has already switched to select). */
  onPlaced: () => void;
}

// Task 3 fills in behavior (pointer handlers currently no-op stubs).
export class SpellTemplateTool implements Tool {
  readonly name = 'spelltemplate';
  constructor(
    private readonly configRef: { current: SpellTemplateConfig | null }
  ) {}
  onPointerDown(_state: PointerState, _ctx: ToolContext): void {}
  onPointerMove(_state: PointerState, _ctx: ToolContext): void {}
  onPointerUp(_state: PointerState, _ctx: ToolContext): void {}
}
