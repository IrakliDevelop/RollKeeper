'use client';

import {
  useEffect,
  useRef,
  type ClipboardEvent,
  type KeyboardEvent,
} from 'react';

import { cn } from '@/utils/cn';

const OTP_LENGTH = 6;

interface OtpCodeInputsProps {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  error?: boolean;
}

export function OtpCodeInputs({
  value,
  onChange,
  onComplete,
  disabled = false,
  error = false,
}: OtpCodeInputsProps) {
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from(
    { length: OTP_LENGTH },
    (_, index) => value[index] ?? ''
  );
  const activeIndex = Math.min(value.length, OTP_LENGTH - 1);

  useEffect(() => {
    if (disabled) return;
    const node =
      inputsRef.current[
        value.length === OTP_LENGTH ? OTP_LENGTH - 1 : value.length
      ];
    node?.focus();
    node?.select();
  }, [disabled, value.length]);

  const focusIndex = (index: number) => {
    const node =
      inputsRef.current[Math.max(0, Math.min(OTP_LENGTH - 1, index))];
    node?.focus();
    node?.select();
  };

  const emit = (next: string) => {
    const clipped = next.replace(/\D/g, '').slice(0, OTP_LENGTH);
    onChange(clipped);
    if (clipped.length === OTP_LENGTH) onComplete?.(clipped);
  };

  const handleChange = (index: number, raw: string) => {
    const chars = raw.replace(/\D/g, '');
    if (!chars) {
      const next = digits.slice();
      next[index] = '';
      onChange(next.join('').replace(/\s/g, ''));
      return;
    }

    const next = digits.slice();
    let cursor = index;
    for (const char of chars) {
      if (cursor >= OTP_LENGTH) break;
      next[cursor] = char;
      cursor += 1;
    }
    emit(next.join(''));
  };

  const handleKeyDown = (
    index: number,
    event: KeyboardEvent<HTMLInputElement>
  ) => {
    if (event.key === 'Backspace') {
      event.preventDefault();
      if (digits[index]) {
        const next = digits.slice();
        next[index] = '';
        onChange(next.join(''));
      } else if (index > 0) {
        const next = digits.slice();
        next[index - 1] = '';
        onChange(next.join(''));
        focusIndex(index - 1);
      }
      return;
    }

    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      focusIndex(index - 1);
    } else if (event.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      event.preventDefault();
      focusIndex(index + 1);
    } else if (event.key === 'Enter' && value.length === OTP_LENGTH) {
      onComplete?.(value);
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '');
    if (!pasted) return;
    event.preventDefault();
    emit(pasted);
  };

  return (
    <div
      className={cn('grid grid-cols-6 gap-2', error && 'animate-rk-otp-shake')}
      onPaste={handlePaste}
      role="group"
      aria-label="Six-digit code"
    >
      {digits.map((digit, index) => {
        const filled = digit !== '';
        const active = !disabled && index === activeIndex && !filled;
        return (
          <input
            key={index}
            ref={node => {
              inputsRef.current[index] = node;
            }}
            inputMode="numeric"
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            maxLength={index === 0 ? OTP_LENGTH : 1}
            aria-label={`Digit ${index + 1} of 6`}
            value={digit}
            disabled={disabled}
            onChange={event => handleChange(index, event.target.value)}
            onKeyDown={event => handleKeyDown(index, event)}
            onFocus={event => event.currentTarget.select()}
            className={cn(
              'bg-surface-raised text-heading h-[60px] w-full rounded-xl border-2 text-center font-mono text-[26px] font-semibold transition-[border-color,box-shadow] duration-150 outline-none',
              error &&
                'border-accent-red-border bg-accent-red-bg text-accent-red-text',
              !error && filled && 'bg-accent-emerald-bg border-emerald-600',
              !error &&
                active &&
                'border-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.14)]',
              !error && !filled && !active && 'border-divider'
            )}
          />
        );
      })}
    </div>
  );
}
