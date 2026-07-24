import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useState } from 'react';
import { NumberInput, NumberField } from '../NumberInput';

afterEach(cleanup);

/**
 * Controlled harness so tests exercise the real string-buffer behavior
 * (the parent stores a number, the component owns the editing buffer).
 */
function Harness({
  initial,
  allowEmpty,
  integer,
  min,
  max,
  onValue,
}: {
  initial: number | undefined;
  allowEmpty?: boolean;
  integer?: boolean;
  min?: number;
  max?: number;
  onValue?: (v: number | undefined) => void;
}) {
  const [value, setValue] = useState<number | undefined>(initial);
  return (
    <NumberInput
      id="score"
      label="Score"
      value={value}
      onChange={v => {
        setValue(v);
        onValue?.(v);
      }}
      allowEmpty={allowEmpty}
      integer={integer}
      min={min}
      max={max}
    />
  );
}

describe('NumberInput / useNumberField', () => {
  it('is not a spinbutton — renders a text input with numeric inputMode', () => {
    render(<Harness initial={0} />);
    const input = screen.getByLabelText('Score') as HTMLInputElement;
    expect(input.type).toBe('text');
    expect(input.inputMode).toBe('numeric');
  });

  it('can be cleared and retyped (the core bug fix) — no snap-back to 0', () => {
    render(<Harness initial={0} />);
    const input = screen.getByLabelText('Score') as HTMLInputElement;

    // The classic bug: value "0", deleting it must actually empty the field.
    fireEvent.change(input, { target: { value: '' } });
    expect(input.value).toBe('');

    fireEvent.change(input, { target: { value: '16' } });
    expect(input.value).toBe('16');
  });

  it('emits the parsed number on change', () => {
    const onValue = vi.fn();
    render(<Harness initial={0} onValue={onValue} />);
    const input = screen.getByLabelText('Score');
    fireEvent.change(input, { target: { value: '16' } });
    expect(onValue).toHaveBeenLastCalledWith(16);
  });

  it('required field falls back to min ?? 0 on blur when left empty', () => {
    const onValue = vi.fn();
    render(<Harness initial={5} min={1} onValue={onValue} />);
    const input = screen.getByLabelText('Score') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);
    expect(input.value).toBe('1');
    expect(onValue).toHaveBeenLastCalledWith(1);
  });

  it('allowEmpty resolves to undefined when cleared', () => {
    const onValue = vi.fn();
    render(<Harness initial={5} allowEmpty onValue={onValue} />);
    const input = screen.getByLabelText('Score');
    fireEvent.change(input, { target: { value: '' } });
    expect(onValue).toHaveBeenLastCalledWith(undefined);
  });

  it('clamps to max on blur, not per keystroke', () => {
    const onValue = vi.fn();
    render(<Harness initial={0} max={20} onValue={onValue} />);
    const input = screen.getByLabelText('Score') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '25' } });
    expect(input.value).toBe('25'); // not fought while typing
    fireEvent.blur(input);
    expect(input.value).toBe('20');
    expect(onValue).toHaveBeenLastCalledWith(20);
  });

  it('rejects non-numeric keystrokes for integer fields', () => {
    render(<Harness initial={3} />);
    const input = screen.getByLabelText('Score') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '3a' } });
    expect(input.value).toBe('3');
  });

  it('supports negative values (modifiers)', () => {
    const onValue = vi.fn();
    render(<Harness initial={0} onValue={onValue} />);
    const input = screen.getByLabelText('Score') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '-2' } });
    expect(input.value).toBe('-2');
    expect(onValue).toHaveBeenLastCalledWith(-2);
  });

  it('supports decimals when integer={false}', () => {
    const onValue = vi.fn();
    render(<Harness initial={0} integer={false} onValue={onValue} />);
    const input = screen.getByLabelText('Score') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '1.5' } });
    expect(input.value).toBe('1.5');
    expect(onValue).toHaveBeenLastCalledWith(1.5);
  });

  it('NumberField preserves a passed className (bare styling)', () => {
    render(
      <NumberField
        value={1}
        onChange={() => {}}
        className="custom-cls"
        aria-label="bare"
      />
    );
    expect(screen.getByLabelText('bare')).toHaveClass('custom-cls');
  });
});
