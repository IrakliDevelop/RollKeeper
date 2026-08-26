import { ProcessedMonster } from '@/types/bestiary';
import { Shield, Heart, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/layout/badge';
import { Card, CardContent } from '@/components/ui/layout/card';
import { getCRColor, formatSize, formatAlignment } from '@/utils/bestiaryUtils';

interface MonsterCardProps {
  monster: ProcessedMonster;
  onClick: () => void;
}

export default function MonsterCard({ monster, onClick }: MonsterCardProps) {
  return (
    <Card
      variant="bordered"
      padding="md"
      interactive
      onClick={onClick}
      className="flex h-full flex-col justify-between transition-all hover:shadow-md"
    >
      <CardContent className="p-0">
        <div className="mb-3 flex items-start justify-between gap-2">
          <h2 className="text-heading flex-1 text-lg leading-tight font-bold">
            {monster.name}
          </h2>
          <Badge
            className={`shrink-0 px-2.5 py-1 text-sm font-bold ${getCRColor(monster.cr)}`}
          >
            CR {monster.cr}
          </Badge>
        </div>
        <p className="text-muted mt-1 text-sm italic">
          {formatSize(monster.size)} {String(monster.type)},{' '}
          {formatAlignment(monster.alignment)}
        </p>

        <div className="text-body mt-4 grid grid-cols-3 gap-x-4 gap-y-2 text-sm">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-accent-blue-text shrink-0" />
            <span>AC {monster.ac.split(' ')[0]}</span>
          </div>
          <div className="flex items-center gap-2">
            <Heart size={16} className="text-accent-red-text shrink-0" />
            <span>HP {monster.hp.split(' ')[0]}</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-accent-amber-text shrink-0" />
            <span className="truncate">{monster.speed.split(',')[0]}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
