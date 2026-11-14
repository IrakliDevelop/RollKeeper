'use client';

import { useMemo } from 'react';
import { Coffee, Moon, X } from 'lucide-react';

import { Button } from '@/components/ui/forms/button';
import { Switch } from '@/components/ui/forms/switch';
import { ConditionChip } from '@/components/ui/game/ConditionChip';
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
      <div
        data-testid="sheet-portrait"
        className="relative size-12 shrink-0 self-start"
      >
        {view.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={view.avatar}
            alt=""
            className="size-12 rounded-full object-cover"
          />
        ) : (
          <div className="bg-surface-raised type-subheading text-heading flex size-12 items-center justify-center rounded-full">
            {view.initial}
          </div>
        )}
        <span className="border-divider bg-surface-elevated type-caption text-heading absolute -right-1.5 -bottom-1.5 rounded-sm border px-1 tabular-nums">
          <span className="sr-only">Character level </span>
          {view.level}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="type-heading text-heading truncate">{view.name}</h2>
        <p className="type-small text-muted truncate">{view.subtitle}</p>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {view.concentration && (
            <ConditionChip kind="concentration" name={view.concentration} />
          )}
          {view.conditions.map(name => (
            <ConditionChip key={name} name={name} />
          ))}
          {view.exhaustion > 0 && (
            <ConditionChip name={`Exhaustion ${view.exhaustion}`} />
          )}
          {view.inspired && (
            <Badge variant="primary" size="sm">
              Inspired
            </Badge>
          )}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <div className="flex items-center gap-2">
          <Switch
            label="Edit sheet"
            size="sm"
            checked={!locked}
            onCheckedChange={onToggleLock}
            wrapperClassName="shrink-0 items-center whitespace-nowrap"
          />
          <Button
            variant="ghost"
            size="sm"
            className="w-9 px-0"
            onClick={onClose}
            aria-label="Close sheet"
          >
            <X size={16} aria-hidden="true" />
          </Button>
        </div>
        <div className="flex gap-1">
          <Button
            variant="secondary"
            size="sm"
            onClick={onShortRest}
            leftIcon={<Coffee size={16} aria-hidden="true" />}
          >
            Short rest
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={onLongRest}
            leftIcon={<Moon size={16} aria-hidden="true" />}
          >
            Long rest
          </Button>
        </div>
      </div>
    </div>
  );
}
