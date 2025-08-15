import { ProcessedMonster } from '@/types/bestiary';
import { Shield, Heart, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getCRColor, formatSize, formatAlignment } from '@/utils/bestiaryUtils';

interface MonsterCardProps {
  monster: ProcessedMonster;
  onClick: () => void;
}

export default function MonsterCard({ monster, onClick }: MonsterCardProps) {
  return (
    <div 
      onClick={onClick}
      className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-5 transition-all duration-300 hover:border-emerald-500/50 hover:shadow-lg hover:shadow-emerald-900/20 cursor-pointer flex flex-col justify-between h-full"
    >
      <div>
        <div className="flex justify-between items-start">
          <h2 className="text-xl font-bold text-slate-100 tracking-wide flex-1 pr-2">{monster.name}</h2>
          <Badge className={`text-base font-bold px-2.5 py-1 ${getCRColor(monster.cr)}`}>
            CR {monster.cr}
          </Badge>
        </div>
        <p className="text-sm text-slate-400 italic mt-1">
          {formatSize(monster.size)} {String(monster.type)}, {formatAlignment(monster.alignment)}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-x-4 gap-y-2 text-sm mt-4 text-slate-300">
        <div className="flex items-center gap-2">
          <Shield size={16} className="text-sky-400" />
          <span>AC {monster.ac.split(' ')[0]}</span>
        </div>
        <div className="flex items-center gap-2">
          <Heart size={16} className="text-red-400" />
          <span>HP {monster.hp.split(' ')[0]}</span>
        </div>
        <div className="flex items-center gap-2">
          <Zap size={16} className="text-yellow-400" />
          <span className="truncate">{monster.speed.split(',')[0]}</span>
        </div>
      </div>
    </div>
  );
}
