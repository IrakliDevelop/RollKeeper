import { useState } from 'react';
import type { LabelSet } from 'pollyroll/render';
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import { SelectField, SelectItem } from '@/components/ui/forms/select';
import { DICE_LABEL_COUNTS } from '@/utils/dicePreferences';
import type { CharacterDiceSet } from '@/types/dice';

function LabelEditor({
  value,
  labelSet,
  onChange,
}: {
  value: CharacterDiceSet;
  labelSet: LabelSet;
  onChange: (value: CharacterDiceSet) => void;
}) {
  const [text, setText] = useState(
    value.options?.labels?.[labelSet]?.join(', ') ?? ''
  );
  const [error, setError] = useState('');
  const remove = () => {
    const labels = { ...value.options?.labels };
    delete labels[labelSet];
    setText('');
    setError('');
    onChange({ ...value, options: { ...value.options, labels } });
  };
  return (
    <div className="space-y-3">
      <Input
        label="Face labels"
        helperText={`Enter ${DICE_LABEL_COUNTS[labelSet]} labels, separated by commas. Use up to 16 characters per face.`}
        value={text}
        error={error || undefined}
        onChange={event => {
          setText(event.target.value);
          setError('');
        }}
        placeholder={labelSet === 'd6' ? '1, 2, 3, 4, 5, 6' : undefined}
      />
      <p className="type-small text-muted">
        Labels change the dice faces, not their numeric results. Coin labels
        start with tails; Fudge labels use minus, blank, plus.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => {
            const labels = text.split(',').map(label => label.trim());
            if (
              labels.length !== DICE_LABEL_COUNTS[labelSet] ||
              labels.some(label => label.length > 16)
            ) {
              setError(
                `Enter ${DICE_LABEL_COUNTS[labelSet]} labels with no more than 16 characters each.`
              );
              return;
            }
            onChange({
              ...value,
              options: {
                ...value.options,
                labels: { ...value.options?.labels, [labelSet]: labels },
              },
            });
            setError('');
          }}
        >
          Apply face labels
        </Button>
        <Button variant="ghost" onClick={remove}>
          Use standard faces
        </Button>
      </div>
    </div>
  );
}

export function DiceFaceLabels({
  value,
  onChange,
}: {
  value: CharacterDiceSet;
  onChange: (value: CharacterDiceSet) => void;
}) {
  const [labelSet, setLabelSet] = useState<LabelSet>('d6');
  return (
    <div className="space-y-4">
      <SelectField
        label="Die to customize"
        value={labelSet}
        onValueChange={next => {
          if (Object.hasOwn(DICE_LABEL_COUNTS, next))
            setLabelSet(next as LabelSet);
        }}
      >
        {Object.keys(DICE_LABEL_COUNTS).map(key => (
          <SelectItem key={key} value={key}>
            {key === 'dc'
              ? 'Coin'
              : key === 'dF'
                ? 'Fudge'
                : key === 'd100tens'
                  ? 'Percentile tens'
                  : key === 'd100ones'
                    ? 'Percentile ones'
                    : key}
          </SelectItem>
        ))}
      </SelectField>
      <LabelEditor
        key={`${labelSet}:${JSON.stringify(value.options?.labels?.[labelSet])}`}
        value={value}
        labelSet={labelSet}
        onChange={onChange}
      />
    </div>
  );
}
