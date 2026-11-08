import { Medallion } from '@/components/ui/game/Medallion';
import { AcShield } from '@/components/ui/game/AcShield';
import { SlotPips } from '@/components/ui/game/SlotPips';
import { cn } from '@/utils/cn';

/**
 * Static glimpses of the two halves of the app, drawn with the real game
 * pieces. Decorative: the door's own text names where it goes.
 */
export function SheetGlimpse() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-4">
      <span className="type-subheading text-heading">Eric Ravenshaw</span>
      <div className="flex items-end gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex items-baseline gap-1">
            <span className="type-num-lg text-ember-text">26</span>
            <span className="type-small text-body">/ 38</span>
          </span>
          <span className="bg-divider block h-1 w-full">
            <span className="bg-ember-fill block h-full w-[68%]" />
          </span>
          <span className="type-caption text-ember-text">Bloodied</span>
        </div>
        <AcShield value={18} className="shrink-0" />
        <div className="hidden gap-2 sm:flex">
          <Medallion
            ability="wisdom"
            score={17}
            modifier={3}
            saveProficient
            abilityDisplay="modifier"
          />
          <Medallion
            ability="dexterity"
            score={14}
            modifier={2}
            saveProficient={false}
            abilityDisplay="modifier"
          />
        </div>
      </div>
      <div className="border-divider flex items-center justify-between gap-3 border-t pt-3">
        <span className="type-small text-body">Spell slots, level 1</span>
        <SlotPips level={1} total={4} available={2} />
      </div>
    </div>
  );
}

const ROWS = [
  { init: 19, name: 'Asteroth Nightveil', hp: 82, tone: 'verdigris' },
  { init: 16, name: 'Night hag', hp: 41, tone: 'ember', active: true },
  { init: 13, name: 'Eric Ravenshaw', hp: 68, tone: 'ember' },
  { init: 8, name: 'Odette Clermont', hp: 100, tone: 'verdigris' },
] as const;

export function InitiativeGlimpse() {
  return (
    <ul aria-hidden="true" className="divide-divider flex flex-col divide-y">
      {ROWS.map(row => (
        <li
          key={row.name}
          className={cn(
            'flex items-center gap-3 py-1.5 pl-2',
            'active' in row && 'border-brass-border border-l-2'
          )}
        >
          <span className="border-divider type-num-md text-heading grid h-8 w-10 place-items-center rounded-sm border">
            {row.init}
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="type-small text-heading truncate">{row.name}</span>
            <span className="bg-divider block h-1 w-full">
              <span
                className={cn(
                  'block h-full',
                  row.tone === 'ember' ? 'bg-ember-fill' : 'bg-verdigris-fill'
                )}
                style={{ width: `${row.hp}%` }}
              />
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
