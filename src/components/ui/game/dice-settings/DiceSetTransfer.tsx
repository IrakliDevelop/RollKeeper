import { useState } from 'react';
import { Button } from '@/components/ui/forms/button';
import { Textarea } from '@/components/ui/forms/textarea';
import { parseDiceSet } from '@/utils/diceSet';
import type { CharacterDiceSet } from '@/types/dice';

export function DiceSetTransfer({
  value,
  onChange,
}: {
  value: CharacterDiceSet;
  onChange: (value: CharacterDiceSet) => void;
}) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-3">
        <Textarea
          label="Your dice set"
          readOnly
          rows={6}
          value={JSON.stringify(value, null, 2)}
        />
        <Button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(
                JSON.stringify(value, null, 2)
              );
              setStatus('Dice set copied');
            } catch {
              setStatus(
                'Could not copy. Select the dice set above and copy it manually.'
              );
            }
          }}
        >
          Copy dice set
        </Button>
        <p role="status" className="type-small text-muted">
          {status}
        </p>
      </div>
      <div className="space-y-3">
        <Textarea
          label="Import a dice set"
          rows={6}
          value={text}
          onChange={event => {
            setText(event.target.value);
            setError('');
          }}
          error={error || undefined}
        />
        <Button
          onClick={() => {
            let input: unknown;
            try {
              input = JSON.parse(text);
            } catch {
              setError('Paste a dice set in JSON format.');
              return;
            }
            const parsed = parseDiceSet(input);
            if (!parsed) {
              setError(
                'This dice set has invalid colors, face labels, or roll settings. Check the values and try again.'
              );
              return;
            }
            onChange(parsed);
            setError('');
            setStatus('Dice set imported');
          }}
        >
          Import dice set
        </Button>
      </div>
    </div>
  );
}
