import { useId } from 'react';

interface Props {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  description?: string;
  displayValue?: string;
  onChange: (value: number) => void;
}

export function DiceSlider({
  label,
  value,
  min = 0,
  max = 1,
  step = 0.05,
  description,
  displayValue,
  onChange,
}: Props) {
  const id = useId();
  return (
    <div className="space-y-2">
      <label
        htmlFor={id}
        className="type-ui text-heading flex items-center justify-between gap-3"
      >
        {label}
        <span aria-hidden="true" className="type-small text-muted tabular-nums">
          {displayValue ?? value.toFixed(2)}
        </span>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={event => onChange(Number(event.target.value))}
        aria-valuetext={displayValue}
        aria-describedby={description ? `${id}-description` : undefined}
        className="accent-brass-fill w-full cursor-pointer pointer-coarse:min-h-11"
      />
      {description && (
        <p id={`${id}-description`} className="type-small text-muted">
          {description}
        </p>
      )}
    </div>
  );
}
