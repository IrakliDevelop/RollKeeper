import type * as React from 'react';
import type { NumberFieldBindings } from '@/hooks/useNumberField';

export interface AnchoredEditorProps {
  /** Names the value: the editor's heading and the steppers' labels. */
  label: string;
  value: number;
  /** Called with the clamped value when the player saves. */
  onSave: (value: number) => void;
  /** Edit mode wires the trigger to the editor; play mode renders it as is. */
  editing: boolean;
  min?: number;
  max?: number;
  /** Parse as an integer (default) or a decimal. */
  integer?: boolean;
  /**
   * Shown under the field, e.g. the AC breakdown. A function gets the
   * number being typed (undefined while the field is empty).
   */
  context?: React.ReactNode | ((draft: number | undefined) => React.ReactNode);
  /**
   * The ornament that opens the editor; a single focusable element. Its
   * classes are joined with the dashed cue without tailwind-merge, so an
   * `outline-none`/`outline-hidden` on it would hide the cue.
   */
  children: React.ReactElement;
}

/** What the popover and the bottom sheet both need. */
export interface EditorShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: React.ReactElement;
  label: string;
  ids: { field: string; label: string; message: string };
  field: NumberFieldBindings;
  fieldRef: React.RefObject<HTMLInputElement | null>;
  min?: number;
  max?: number;
  integer: boolean;
  context: AnchoredEditorProps['context'];
  onSave: () => void;
  onCancel: () => void;
}
