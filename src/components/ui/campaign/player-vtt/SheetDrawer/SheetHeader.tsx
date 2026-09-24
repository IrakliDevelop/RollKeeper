'use client';

import { useMemo } from 'react';
import { Coffee, Lock, Moon, Star, Unlock, X, Zap } from 'lucide-react';

import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';
import { useCharacterStore } from '@/store/characterStore';

import { buildHeaderView } from './SheetDrawer.utils';

export interface SheetHeaderProps {
  locked: boolean;
  onToggleLock: () => void;
  onClose: () => void;
  onShortRest: () => void;
  onLongRest: () => void;
}

export function SheetHeader({
  locked,
  onToggleLock,
  onClose,
  onShortRest,
  onLongRest,
}: SheetHeaderProps) {
  const character = useCharacterStore(s => s.character);
  const view = useMemo(() => buildHeaderView(character), [character]);

  return (
    <div className="border-divider flex gap-3 border-b px-5 pt-4 pb-3">
      <div className="relative shrink-0">
        {view.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={view.avatar}
            alt=""
            className="h-14 w-14 rounded-xl object-cover"
          />
        ) : (
          <div className="bg-accent-emerald-bg text-accent-emerald-text flex h-14 w-14 items-center justify-center rounded-xl text-2xl font-bold">
            {view.initial}
          </div>
        )}
        <span
          title={`Character level ${view.level}`}
          className="bg-surface-elevated border-divider text-heading absolute -right-1.5 -bottom-1.5 rounded-full border px-1.5 text-xs font-bold"
        >
          {view.level}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="text-heading truncate text-xl font-bold">{view.name}</h2>
        <p className="text-muted truncate text-xs">{view.subtitle}</p>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {view.concentration && (
            <Badge variant="info">
              <Zap className="mr-1 h-3 w-3" />
              {view.concentration}
            </Badge>
          )}
          {view.conditions.map(name => (
            <Badge key={name} variant="danger">
              {name}
            </Badge>
          ))}
          {view.exhaustion > 0 && (
            <Badge variant="warning">Exhaustion {view.exhaustion}</Badge>
          )}
          {view.inspired && (
            <Badge variant="success">
              <Star className="mr-1 h-3 w-3" />
              Inspired
            </Badge>
          )}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <div className="flex items-center gap-1">
          <Button
            variant={locked ? 'outline' : 'warning'}
            size="sm"
            onClick={onToggleLock}
            title={locked ? 'Unlock to edit' : 'Lock the sheet'}
          >
            {locked ? (
              <Lock className="mr-1 h-3.5 w-3.5" />
            ) : (
              <Unlock className="mr-1 h-3.5 w-3.5" />
            )}
            {locked ? 'Locked' : 'Editing'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="Close sheet"
            title="Close (Esc)"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" onClick={onShortRest}>
            <Coffee className="mr-1 h-3.5 w-3.5" />
            Short rest
          </Button>
          <Button variant="outline" size="sm" onClick={onLongRest}>
            <Moon className="mr-1 h-3.5 w-3.5" />
            Long rest
          </Button>
        </div>
      </div>
    </div>
  );
}
