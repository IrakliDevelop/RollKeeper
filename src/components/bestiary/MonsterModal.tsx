import { ProcessedMonster } from '@/types/bestiary';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/feedback/dialog';
import { Badge } from '@/components/ui';
import { getCRColor, formatSize, formatAlignment } from '@/utils/bestiaryUtils';
import { Shield, Heart, Zap, Swords, Brain, Star } from 'lucide-react';

interface MonsterModalProps {
  monster: ProcessedMonster | null;
  onOpenChange: (open: boolean) => void;
}

const StatBlock = ({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
}) => (
  <div className="flex flex-col items-center justify-center rounded-md border border-slate-700/50 bg-slate-800/70 p-3">
    <Icon className="mb-1.5 h-6 w-6 text-sky-300" />
    <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
      {label}
    </span>
    <span className="text-lg font-bold text-slate-100">{value}</span>
  </div>
);

export default function MonsterModal({
  monster,
  onOpenChange,
}: MonsterModalProps) {
  if (!monster) return null;

  return (
    <Dialog open={!!monster} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-4xl overflow-y-auto border-slate-700 bg-slate-900 p-0 text-slate-200">
        <DialogHeader className="p-6 pb-4">
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-3xl font-bold tracking-wider text-white">
                {monster.name}
              </DialogTitle>
              <DialogDescription className="text-md text-slate-400 italic">
                {formatSize(monster.size)} {String(monster.type)},{' '}
                {formatAlignment(monster.alignment)}
              </DialogDescription>
            </div>
            <Badge
              className={`px-4 py-1.5 text-lg font-bold ${getCRColor(monster.cr)}`}
            >
              CR {monster.cr}
            </Badge>
          </div>
        </DialogHeader>

        <div className="px-6 pb-6">
          {/* Core Stats */}
          <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
            <div className="flex items-center gap-3 rounded-md border border-slate-700/50 bg-slate-800/50 p-3">
              <Shield size={24} className="text-sky-400" />
              <div>
                <div className="text-lg font-bold text-slate-100">
                  {monster.ac}
                </div>
                <div className="text-xs text-slate-400">Armor Class</div>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-md border border-slate-700/50 bg-slate-800/50 p-3">
              <Heart size={24} className="text-red-400" />
              <div>
                <div className="text-lg font-bold text-slate-100">
                  {monster.hp}
                </div>
                <div className="text-xs text-slate-400">Hit Points</div>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-md border border-slate-700/50 bg-slate-800/50 p-3">
              <Zap size={24} className="text-yellow-400" />
              <div>
                <div className="truncate text-lg font-bold text-slate-100">
                  {monster.speed}
                </div>
                <div className="text-xs text-slate-400">Speed</div>
              </div>
            </div>
          </div>

          {/* Ability Scores */}
          <div className="mb-6 grid grid-cols-6 gap-2">
            <StatBlock icon={Swords} label="STR" value={monster.str} />
            <StatBlock icon={Zap} label="DEX" value={monster.dex} />
            <StatBlock icon={Heart} label="CON" value={monster.con} />
            <StatBlock icon={Brain} label="INT" value={monster.int} />
            <StatBlock icon={Star} label="WIS" value={monster.wis} />
            <StatBlock icon={Star} label="CHA" value={monster.cha} />
          </div>

          {/* Other Details */}
          <div className="space-y-2 text-sm [&>p]:border-b [&>p]:border-slate-800 [&>p]:py-2">
            {monster.saves && (
              <p>
                <strong className="pr-2 font-semibold text-slate-300">
                  Saving Throws:
                </strong>{' '}
                {monster.saves}
              </p>
            )}
            {monster.skills && (
              <p>
                <strong className="pr-2 font-semibold text-slate-300">
                  Skills:
                </strong>{' '}
                {monster.skills}
              </p>
            )}
            {monster.resistances && (
              <p>
                <strong className="pr-2 font-semibold text-slate-300">
                  Resistances:
                </strong>{' '}
                {monster.resistances}
              </p>
            )}
            {monster.immunities && (
              <p>
                <strong className="pr-2 font-semibold text-slate-300">
                  Immunities:
                </strong>{' '}
                {monster.immunities}
              </p>
            )}
            {monster.vulnerabilities && (
              <p>
                <strong className="pr-2 font-semibold text-slate-300">
                  Vulnerabilities:
                </strong>{' '}
                {monster.vulnerabilities}
              </p>
            )}
            {monster.senses && (
              <p>
                <strong className="pr-2 font-semibold text-slate-300">
                  Senses:
                </strong>{' '}
                {monster.senses}, passive Perception {monster.passivePerception}
              </p>
            )}
            {monster.languages && (
              <p>
                <strong className="pr-2 font-semibold text-slate-300">
                  Languages:
                </strong>{' '}
                {monster.languages}
              </p>
            )}
          </div>

          {/* Traits, Actions, etc. */}
          <div className="prose prose-sm prose-invert mt-6 max-w-none space-y-5">
            {monster.traits && monster.traits.length > 0 && (
              <h3 className="mb-3 border-b border-emerald-400/30 pb-2 text-xl font-bold text-emerald-400">
                Traits
              </h3>
            )}
            {monster.traits?.map((t, i) => (
              <div key={`trait-${i}`}>
                <h4 className="font-bold text-slate-100">{t.name}</h4>
                <div
                  className="whitespace-pre-line text-slate-300"
                  dangerouslySetInnerHTML={{ __html: t.text }}
                />
              </div>
            ))}
            {monster.actions && monster.actions.length > 0 && (
              <h3 className="mb-3 border-b border-emerald-400/30 pb-2 text-xl font-bold text-emerald-400">
                Actions
              </h3>
            )}
            {monster.actions?.map((a, i) => (
              <div key={`action-${i}`}>
                <h4 className="font-bold text-slate-100">{a.name}</h4>
                <div
                  className="whitespace-pre-line text-slate-300"
                  dangerouslySetInnerHTML={{ __html: a.text }}
                />
              </div>
            ))}
            {monster.legendaryActions &&
              monster.legendaryActions.length > 0 && (
                <h3 className="mb-3 border-b border-emerald-400/30 pb-2 text-xl font-bold text-emerald-400">
                  Legendary Actions
                </h3>
              )}
            {monster.legendaryActions?.map((la, i) => (
              <div key={`legendary-${i}`}>
                <h4 className="font-bold text-slate-100">{la.name}</h4>
                <div
                  className="whitespace-pre-line text-slate-300"
                  dangerouslySetInnerHTML={{ __html: la.text }}
                />
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
