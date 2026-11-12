'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { cn } from '@/utils/cn';

const COPIED_DURATION_MS = 2000;

interface CopyCodeButtonProps {
  code: string;
  className?: string;
}

export function CopyCodeButton({ code, className }: CopyCodeButtonProps) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  const handleCopy = async () => {
    if (!navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      return;
    }
    clearTimer();
    setCopied(true);
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      setCopied(false);
    }, COPIED_DURATION_MS);
  };

  const Icon = copied ? Check : Copy;

  return (
    <span className="inline-flex">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn('font-mono', className)}
        leftIcon={<Icon size={14} aria-hidden="true" />}
        aria-label={copied ? `Code ${code} copied` : `Copy code ${code}`}
        onClick={handleCopy}
      >
        {code}
      </Button>
      <span role="status" className="sr-only">
        {copied ? `Code ${code} copied` : ''}
      </span>
    </span>
  );
}
