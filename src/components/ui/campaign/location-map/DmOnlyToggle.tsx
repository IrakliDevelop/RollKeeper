'use client';

import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';

interface DmOnlyToggleProps {
  isDmOnly: boolean;
  onToggle: () => void;
}

export default function DmOnlyToggle({
  isDmOnly,
  onToggle,
}: DmOnlyToggleProps) {
  return (
    <Button
      variant={isDmOnly ? 'warning' : 'ghost'}
      onClick={onToggle}
      title={isDmOnly ? 'DM Only — hidden from players' : 'Visible to players'}
      className="flex items-center gap-1 px-2 py-1 text-xs"
    >
      {isDmOnly ? <EyeOff size={14} /> : <Eye size={14} />}
      <span className="hidden sm:inline">
        {isDmOnly ? 'DM Only' : 'Visible'}
      </span>
    </Button>
  );
}
