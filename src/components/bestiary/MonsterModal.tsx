import { ProcessedMonster } from '@/types/bestiary';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
} from '@/components/ui/feedback/dialog-new';
import { Badge } from '@/components/ui/layout/badge';
import { Card, CardContent } from '@/components/ui/layout/card';
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
  <Card variant="bordered" padding="sm">
    <CardContent className="flex flex-col items-center justify-center p-0">
      <Icon className="text-accent-blue-text mb-1.5 h-5 w-5" />
      <span className="text-faint text-xs font-semibold tracking-wider uppercase">
        {label}
      </span>
      <span className="text-heading text-lg font-bold">{value}</span>
    </CardContent>
  </Card>
);

export default function MonsterModal({
  monster,
  onOpenChange,
}: MonsterModalProps) {
  if (!monster) return null;

  return (
    <Dialog open={!!monster} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader className="pr-10">
          <div className="flex items-start justify-between gap-3">
            <div>
              <DialogTitle className="text-2xl sm:text-3xl">
                {monster.name}
              </DialogTitle>
              <DialogDescription className="text-muted text-base italic">
                {formatSize(monster.size)} {String(monster.type)},{' '}
                {formatAlignment(monster.alignment)}
              </DialogDescription>
            </div>
            <Badge
              className={`shrink-0 px-4 py-1.5 text-lg font-bold ${getCRColor(monster.cr)}`}
            >
              CR {monster.cr}
            </Badge>
          </div>
        </DialogHeader>

        <DialogBody>
          <div className="space-y-6">
            {/* Core Stats */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Card variant="bordered" padding="sm">
                <CardContent className="flex items-center gap-3 p-0">
                  <Shield
                    size={22}
                    className="text-accent-blue-text shrink-0"
                  />
                  <div>
                    <div className="text-heading text-lg font-bold">
                      {monster.ac}
                    </div>
                    <div className="text-faint text-xs">Armor Class</div>
                  </div>
                </CardContent>
              </Card>
              <Card variant="bordered" padding="sm">
                <CardContent className="flex items-center gap-3 p-0">
                  <Heart size={22} className="text-accent-red-text shrink-0" />
                  <div>
                    <div className="text-heading text-lg font-bold">
                      {monster.hp}
                    </div>
                    <div className="text-faint text-xs">Hit Points</div>
                  </div>
                </CardContent>
              </Card>
              <Card variant="bordered" padding="sm">
                <CardContent className="flex items-center gap-3 p-0">
                  <Zap size={22} className="text-accent-amber-text shrink-0" />
                  <div>
                    <div className="text-heading truncate text-lg font-bold">
                      {monster.speed}
                    </div>
                    <div className="text-faint text-xs">Speed</div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Ability Scores */}
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              <StatBlock icon={Swords} label="STR" value={monster.str} />
              <StatBlock icon={Zap} label="DEX" value={monster.dex} />
              <StatBlock icon={Heart} label="CON" value={monster.con} />
              <StatBlock icon={Brain} label="INT" value={monster.int} />
              <StatBlock icon={Star} label="WIS" value={monster.wis} />
              <StatBlock icon={Star} label="CHA" value={monster.cha} />
            </div>

            {/* Details */}
            <div className="text-body border-divider space-y-0 text-sm [&>p]:border-b [&>p]:py-2.5">
              {monster.saves && (
                <p>
                  <strong className="text-heading pr-2 font-semibold">
                    Saving Throws:
                  </strong>{' '}
                  {monster.saves}
                </p>
              )}
              {monster.skills && (
                <p>
                  <strong className="text-heading pr-2 font-semibold">
                    Skills:
                  </strong>{' '}
                  {monster.skills}
                </p>
              )}
              {monster.resistances && (
                <p>
                  <strong className="text-heading pr-2 font-semibold">
                    Resistances:
                  </strong>{' '}
                  {monster.resistances}
                </p>
              )}
              {monster.immunities && (
                <p>
                  <strong className="text-heading pr-2 font-semibold">
                    Immunities:
                  </strong>{' '}
                  {monster.immunities}
                </p>
              )}
              {monster.vulnerabilities && (
                <p>
                  <strong className="text-heading pr-2 font-semibold">
                    Vulnerabilities:
                  </strong>{' '}
                  {monster.vulnerabilities}
                </p>
              )}
              {monster.senses && (
                <p>
                  <strong className="text-heading pr-2 font-semibold">
                    Senses:
                  </strong>{' '}
                  {monster.senses}, passive Perception{' '}
                  {monster.passivePerception}
                </p>
              )}
              {monster.languages && (
                <p>
                  <strong className="text-heading pr-2 font-semibold">
                    Languages:
                  </strong>{' '}
                  {monster.languages}
                </p>
              )}
            </div>

            {/* Traits, Actions, Legendary Actions */}
            <div className="space-y-5">
              {monster.traits && monster.traits.length > 0 && (
                <div>
                  <h3 className="text-accent-red-text border-accent-red-border mb-3 border-b pb-2 text-xl font-bold">
                    Traits
                  </h3>
                  {monster.traits.map((t, i) => (
                    <div key={`trait-${i}`} className="mb-3">
                      <h4 className="text-heading font-bold">{t.name}</h4>
                      <div
                        className="text-body text-sm whitespace-pre-line"
                        dangerouslySetInnerHTML={{ __html: t.text }}
                      />
                    </div>
                  ))}
                </div>
              )}

              {monster.actions && monster.actions.length > 0 && (
                <div>
                  <h3 className="text-accent-red-text border-accent-red-border mb-3 border-b pb-2 text-xl font-bold">
                    Actions
                  </h3>
                  {monster.actions.map((a, i) => (
                    <div key={`action-${i}`} className="mb-3">
                      <h4 className="text-heading font-bold">{a.name}</h4>
                      <div
                        className="text-body text-sm whitespace-pre-line"
                        dangerouslySetInnerHTML={{ __html: a.text }}
                      />
                    </div>
                  ))}
                </div>
              )}

              {monster.legendaryActions &&
                monster.legendaryActions.length > 0 && (
                  <div>
                    <h3 className="text-accent-red-text border-accent-red-border mb-3 border-b pb-2 text-xl font-bold">
                      Legendary Actions
                    </h3>
                    {monster.legendaryActions.map((la, i) => (
                      <div key={`legendary-${i}`} className="mb-3">
                        <h4 className="text-heading font-bold">{la.name}</h4>
                        <div
                          className="text-body text-sm whitespace-pre-line"
                          dangerouslySetInnerHTML={{ __html: la.text }}
                        />
                      </div>
                    ))}
                  </div>
                )}
            </div>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
