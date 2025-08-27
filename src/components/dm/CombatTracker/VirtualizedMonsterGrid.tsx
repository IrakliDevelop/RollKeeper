'use client';

import React from 'react';
import { ProcessedMonster } from '@/types/bestiary';
import { useVirtualizedGrid } from '@/components/ui/layout/VirtualizedList';
import { formatMonsterType, parseChallengeRating } from '@/utils/dm/monsterUtils';
import { Plus, Crown, Skull } from 'lucide-react';

interface VirtualizedMonsterGridProps {
  monsters: ProcessedMonster[];
  onAddMonster: (monster: ProcessedMonster) => void;
  selectedMonsters: ProcessedMonster[];
  monsterQuantities: Record<string, number>;
  onQuantityChange: (monsterId: string, quantity: number) => void;
  containerWidth: number;
  containerHeight: number;
  loading?: boolean;
}

const MONSTER_CARD_WIDTH = 280;
const MONSTER_CARD_HEIGHT = 200;
const GRID_GAP = 16;

export function VirtualizedMonsterGrid({
  monsters,
  onAddMonster,
  selectedMonsters,
  monsterQuantities,
  onQuantityChange,
  containerWidth,
  containerHeight,
  loading = false
}: VirtualizedMonsterGridProps) {
  const {
    visibleItems,
    visibleRange,
    totalHeight,
    offsetY,
    columnsPerRow,
    handleScroll,
  } = useVirtualizedGrid({
    items: monsters,
    itemWidth: MONSTER_CARD_WIDTH,
    itemHeight: MONSTER_CARD_HEIGHT,
    containerWidth,
    containerHeight,
    gap: GRID_GAP,
  });

  const renderMonsterCard = (monster: ProcessedMonster, index: number) => {
    const isSelected = selectedMonsters.some(m => m.id === monster.id);
    const quantity = monsterQuantities[monster.id] || 1;
    const columnIndex = index % columnsPerRow;
    const leftOffset = columnIndex * (MONSTER_CARD_WIDTH + GRID_GAP);

    return (
      <div
        key={monster.id}
        className="absolute"
        style={{
          left: leftOffset,
          width: MONSTER_CARD_WIDTH,
          height: MONSTER_CARD_HEIGHT,
        }}
      >
        <div className={`
          h-full bg-white rounded-lg border-2 transition-all duration-200 cursor-pointer
          ${isSelected 
            ? 'border-blue-500 bg-blue-50 shadow-lg scale-105' 
            : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
          }
        `}>
          <div className="p-4 h-full flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-start mb-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-900 truncate text-sm">
                  {monster.name}
                </h3>
                <p className="text-xs text-gray-600 truncate">
                  {formatMonsterType(monster)} • CR {monster.cr}
                </p>
              </div>
              <div className="flex items-center gap-1 ml-2">
                {parseChallengeRating(monster.cr) >= 10 && (
                  <Crown size={14} className="text-yellow-500" />
                )}
                {parseChallengeRating(monster.cr) >= 20 && (
                  <Skull size={14} className="text-red-500" />
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 text-xs mb-3 flex-1">
              <div className="text-center">
                <div className="font-medium text-gray-700">AC</div>
                <div className="text-gray-600">{monster.ac}</div>
              </div>
              <div className="text-center">
                <div className="font-medium text-gray-700">HP</div>
                <div className="text-gray-600">{monster.hp}</div>
              </div>
              <div className="text-center">
                <div className="font-medium text-gray-700">Speed</div>
                <div className="text-gray-600">{monster.speed}</div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between mt-auto">
              {isSelected ? (
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-xs text-gray-600">Qty:</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onQuantityChange(monster.id, Math.max(1, quantity - 1));
                      }}
                      className="w-6 h-6 bg-gray-200 hover:bg-gray-300 rounded text-xs font-bold"
                    >
                      -
                    </button>
                    <span className="w-8 text-center text-xs font-medium">
                      {quantity}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onQuantityChange(monster.id, quantity + 1);
                      }}
                      className="w-6 h-6 bg-gray-200 hover:bg-gray-300 rounded text-xs font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddMonster(monster);
                  }}
                  className="flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-md transition-colors"
                >
                  <Plus size={12} />
                  Add
                </button>
              )}
              
              <div className="text-xs text-gray-500 ml-2">
                {monster.source}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading monsters...</div>
      </div>
    );
  }

  if (monsters.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">No monsters found</div>
      </div>
    );
  }

  return (
    <div
      className="overflow-auto"
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div
          style={{
            transform: `translateY(${offsetY}px)`,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
          }}
        >
          {visibleItems.map((monster, index) => 
            renderMonsterCard(monster, visibleRange.start + index)
          )}
        </div>
      </div>
    </div>
  );
}
