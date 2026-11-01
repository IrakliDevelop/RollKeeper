'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createRoll } from 'pollyroll';
import { useDiceTray } from 'pollyroll/react';
import { formatRoll } from 'pollyroll/format';
import { diceClacks } from 'pollyroll/sounds';
import { Button } from '@/components/ui/forms/button';
import { SelectField, SelectItem } from '@/components/ui/forms/select';
import type { CharacterDiceSet } from '@/types/dice';

const ROLLS = [
  ['1d20+1d12+1d10+1d8+1d6+1d4', 'Full set'],
  ['1d20', 'One d20'],
  ['adv+3', 'Advantage'],
  ['dis+3', 'Disadvantage'],
  ['1d%', 'Percentile'],
  ['4dF', 'Fudge dice'],
  ['3dc', 'Coins'],
  ['2d2', 'Two-sided dice'],
  ['4d6dl1', 'Drop the lowest'],
  ['3d6!', 'Exploding dice'],
  ['4d6r1', 'Reroll ones'],
  ['5d10>=7', 'Count successes'],
] as const;

function Scene({
  value,
  notation,
  animate,
  onResult,
  rollToken,
}: {
  value: CharacterDiceSet;
  notation: string;
  animate: boolean;
  onResult: (text: string) => void;
  rollToken: number;
}) {
  const target = useRef<HTMLDivElement>(null);
  const tray = useDiceTray(target, {
    ...value.options,
    skin: value.skin,
    dieScale: value.dieScale,
    clacks: diceClacks,
    sound: animate ? (value.options?.sound ?? 0) : 0,
    reducedMotion: animate
      ? (value.options?.reducedMotion ?? 'auto')
      : 'always',
    fadeAfterMs: animate ? (value.options?.fadeAfterMs ?? null) : null,
    announce: animate && (value.options?.announce ?? false),
  });
  useEffect(() => {
    if (!tray) return;
    let active = true;
    const event = createRoll(notation, { skin: value.skin });
    tray
      .playRoll(event)
      .then(summary => {
        if (active) onResult(formatRoll(event, summary));
      })
      .catch(() => {
        if (active)
          onResult('The preview could not finish. Try rolling again.');
      });
    return () => {
      active = false;
    };
  }, [tray, notation, value.skin, value.dieScale, rollToken, onResult]);
  return (
    <>
      <div
        ref={target}
        className="bg-surface-inset border-divider relative aspect-[4/3] w-full overflow-hidden rounded-md border"
        aria-label="Dice preview"
      />
      {tray && !tray.supported && (
        <p className="type-small text-muted mt-2">
          3D dice are unavailable in this browser. Preview results still appear
          below.
        </p>
      )}
    </>
  );
}

export function DicePreview({ value }: { value: CharacterDiceSet }) {
  const [notation, setNotation] = useState<string>(ROLLS[0][0]);
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);
  const [request, setRequest] = useState({ key: '', count: 0 });
  const key = JSON.stringify(value);
  const animate = request.key === key;
  const sceneKey = `${JSON.stringify({ ...value.options, sound: undefined })}:${animate}`;
  const handleResult = useCallback((text: string) => {
    setResult(text);
    setBusy(false);
  }, []);
  return (
    <div className="space-y-4">
      <Scene
        key={sceneKey}
        value={value}
        notation={notation}
        animate={animate}
        rollToken={request.count}
        onResult={handleResult}
      />
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <SelectField
            label="Preview dice"
            value={notation}
            onValueChange={setNotation}
          >
            {ROLLS.map(([roll, label]) => (
              <SelectItem key={roll} value={roll}>
                {label}
              </SelectItem>
            ))}
          </SelectField>
        </div>
        <Button
          variant="primary"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            setRequest(current => ({ key, count: current.count + 1 }));
          }}
        >
          {busy ? 'Rolling…' : 'Roll preview'}
        </Button>
      </div>
      <p className="type-small text-muted">
        Preview rolls do not spend spell slots or change your character.
      </p>
      <p
        role="status"
        aria-label="Preview roll result"
        className="type-small text-body min-h-6 break-words"
      >
        {result}
      </p>
    </div>
  );
}
