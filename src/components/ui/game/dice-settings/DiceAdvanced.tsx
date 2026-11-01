import { DiceSlider } from './DiceSlider';
import { DiceFaceLabels } from './DiceFaceLabels';
import { DiceSetTransfer } from './DiceSetTransfer';
import type { CharacterDiceSet } from '@/types/dice';

const FINISH = [
  ['metalness', 'Metallic finish'],
  ['roughness', 'Roughness'],
  ['clearcoat', 'Clear coating'],
  ['transmission', 'Transparency'],
  ['tint', 'Color depth'],
  ['sparkle', 'Gem glints'],
] as const;

export function DiceAdvanced({
  value,
  onChange,
}: {
  value: CharacterDiceSet;
  onChange: (value: CharacterDiceSet) => void;
}) {
  const material =
    typeof value.skin.material === 'object' ? value.skin.material : null;
  return (
    <details className="border-divider border-t pt-4">
      <summary className="type-ui text-heading cursor-pointer py-2 pointer-coarse:min-h-11">
        Advanced dice settings
      </summary>
      <div className="mt-4 space-y-6">
        {material && (
          <div className="grid gap-4 sm:grid-cols-2">
            {FINISH.map(([key, label]) => (
              <DiceSlider
                key={key}
                label={label}
                step={0.01}
                value={material[key] ?? 0}
                onChange={next =>
                  onChange({
                    ...value,
                    skin: {
                      ...value.skin,
                      material: { ...material, [key]: next },
                    },
                  })
                }
              />
            ))}
          </div>
        )}
        <DiceFaceLabels value={value} onChange={onChange} />
        <DiceSetTransfer value={value} onChange={onChange} />
      </div>
    </details>
  );
}
