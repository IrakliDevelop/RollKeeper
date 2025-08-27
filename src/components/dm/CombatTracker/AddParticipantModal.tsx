'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Skull, Search, Plus, Crown, Loader2 } from 'lucide-react';
import { CombatParticipant } from '@/types/combat';
import { ProcessedMonster } from '@/types/bestiary';
import { useDMStore } from '@/store/dmStore';
import { useCombatStore } from '@/store/combatStore';
import {
  monsterToCombatParticipant,
  parseChallengeRating,
  formatMonsterType,
} from '@/utils/dm/monsterUtils';
import { useDebouncedSearch } from '@/hooks/useDebounce';
import { VirtualizedMonsterGrid } from './VirtualizedMonsterGrid';
import { Modal } from '@/components/ui/feedback/Modal';

interface AddParticipantModalProps {
  campaignId: string;
  onClose: () => void;
}

type TabMode = 'players' | 'monsters';

export function AddParticipantModal({
  campaignId,
  onClose,
}: AddParticipantModalProps) {
  const [activeTab, setActiveTab] = useState<TabMode>('players');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [selectedMonsters, setSelectedMonsters] = useState<ProcessedMonster[]>(
    []
  );
  const [monsterQuantities, setMonsterQuantities] = useState<
    Record<string, number>
  >({});
  const [loading, setLoading] = useState(false);
  const [monsters, setMonsters] = useState<ProcessedMonster[]>([]);
  const [crFilter, setCRFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');

  const { getCampaignById } = useDMStore();
  const { addParticipant } = useCombatStore();

  const campaign = getCampaignById(campaignId);

  // Load monsters data (simplified for now - in real implementation this would use the bestiary loader)
  useEffect(() => {
    const loadMonsters = async () => {
      setLoading(true);
      try {
        // Use lazy loading to avoid blocking initial page load
        const { lazyLoadBestiary } = await import('@/utils/lazyDataLoader');
        const allMonsters = await lazyLoadBestiary();
        setMonsters(allMonsters);
        console.log(`Combat tracker: Loaded ${allMonsters.length} monsters`);
      } catch (error) {
        console.error('Failed to load monsters:', error);
        // Fallback to empty array if loading fails
        setMonsters([]);
      } finally {
        setLoading(false);
      }
    };

    if (activeTab === 'monsters') {
      loadMonsters();
    }
  }, [activeTab]);

  // Use debounced search to reduce filtering operations
  const { debouncedSearchTerm, isSearching } = useDebouncedSearch(
    searchTerm,
    300
  );

  // Memoized filtered players to avoid unnecessary re-computations
  const filteredPlayers = useMemo(() => {
    if (!campaign?.playerCharacters) return [];

    return campaign.playerCharacters.filter(
      pc =>
        pc.characterData.name
          .toLowerCase()
          .includes(debouncedSearchTerm.toLowerCase()) ||
        pc.characterData.class?.name
          .toLowerCase()
          .includes(debouncedSearchTerm.toLowerCase())
    );
  }, [campaign?.playerCharacters, debouncedSearchTerm]);

  // Memoized filtered monsters with optimized search and pagination
  const filteredMonsters = useMemo(() => {
    if (!monsters.length) return [];

    const filtered = monsters.filter(monster => {
      // Search optimization: only search if there's a search term
      const matchesSearch =
        !debouncedSearchTerm ||
        monster.name
          .toLowerCase()
          .includes(debouncedSearchTerm.toLowerCase()) ||
        (() => {
          // Safe type checking for monster.type
          if (typeof monster.type === 'string') {
            return monster.type
              .toLowerCase()
              .includes(debouncedSearchTerm.toLowerCase());
          } else if (
            monster.type &&
            typeof monster.type === 'object' &&
            monster.type.type
          ) {
            return monster.type.type
              .toLowerCase()
              .includes(debouncedSearchTerm.toLowerCase());
          }
          return false;
        })() ||
        monster.cr.toLowerCase().includes(debouncedSearchTerm.toLowerCase());

      const matchesCR = !crFilter || monster.cr === crFilter;
      const matchesType =
        !typeFilter ||
        (() => {
          // Safe type extraction for comparison
          if (typeof monster.type === 'string') {
            return monster.type === typeFilter;
          } else if (
            monster.type &&
            typeof monster.type === 'object' &&
            monster.type.type
          ) {
            return monster.type.type === typeFilter;
          }
          return false;
        })();

      return matchesSearch && matchesCR && matchesType;
    });

    return filtered.slice(0, 50);
  }, [monsters, debouncedSearchTerm, crFilter, typeFilter]);

  const handlePlayerToggle = (playerId: string) => {
    setSelectedPlayers(prev =>
      prev.includes(playerId)
        ? prev.filter(id => id !== playerId)
        : [...prev, playerId]
    );
  };

  const handleMonsterToggle = (monster: ProcessedMonster) => {
    setSelectedMonsters(prev => {
      const exists = prev.find(m => m.id === monster.id);
      if (exists) {
        return prev.filter(m => m.id !== monster.id);
      } else {
        setMonsterQuantities(prev => ({ ...prev, [monster.id]: 1 }));
        return [...prev, monster];
      }
    });
  };

  const handleQuantityChange = (monsterId: string, quantity: number) => {
    setMonsterQuantities(prev => ({
      ...prev,
      [monsterId]: Math.max(1, quantity),
    }));
  };

  const handleAddParticipants = () => {
    // Add selected players
    selectedPlayers.forEach(playerId => {
      const playerCharacter = campaign?.playerCharacters.find(
        pc => pc.id === playerId
      );
      if (playerCharacter) {
        const participant: Omit<CombatParticipant, 'id' | 'turnOrder'> = {
          type: 'player',
          name: playerCharacter.characterData.name,
          armorClass: playerCharacter.characterData.armorClass || 10,
          hitPoints: playerCharacter.characterData.hitPoints,
          hasReaction: true,
          hasBonusAction: true,
          class: playerCharacter.characterData.class?.name,
          level: playerCharacter.characterData.level,
          initiative: 0,
          dexterityModifier: Math.floor(
            (playerCharacter.characterData.abilities?.dexterity || 10 - 10) / 2
          ),
          position: { x: 0, y: 0 },
          conditions: [],
          characterReference: {
            campaignId,
            characterId: playerCharacter.id,
            characterData: playerCharacter.characterData,
          },
        };
        addParticipant(participant);
      }
    });

    // Add selected monsters
    selectedMonsters.forEach(monster => {
      const quantity = monsterQuantities[monster.id] || 1;
      for (let i = 0; i < quantity; i++) {
        const participant = monsterToCombatParticipant(
          monster,
          quantity > 1 ? `${monster.name} ${i + 1}` : monster.name
        );
        addParticipant(participant);
      }
    });

    onClose();
  };

  const getUniqueValues = (field: 'cr' | 'type'): string[] => {
    const values = monsters
      .map(monster => {
        if (field === 'type') {
          // Safe type extraction
          if (typeof monster.type === 'string') {
            return monster.type;
          } else if (
            monster.type &&
            typeof monster.type === 'object' &&
            monster.type.type
          ) {
            return monster.type.type;
          }
          return 'Unknown'; // Fallback for undefined types
        }
        return monster[field];
      })
      .filter(value => value != null && value !== ''); // Remove null/undefined/empty values

    return [...new Set(values)].sort((a, b) => {
      if (field === 'cr') {
        return parseChallengeRating(a) - parseChallengeRating(b);
      }
      return a.localeCompare(b);
    });
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Add Participants to Combat"
      size="xl"
      className="flex max-h-[90vh] flex-col"
    >
      {/* Tabs */}
      <div className="border-b border-gray-200 p-6">
        <div className="flex rounded-lg bg-gray-100 p-1">
          <button
            onClick={() => setActiveTab('players')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 transition-colors ${
              activeTab === 'players'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <Crown size={16} />
            Campaign Players ({filteredPlayers.length})
          </button>
          <button
            onClick={() => setActiveTab('monsters')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 transition-colors ${
              activeTab === 'monsters'
                ? 'bg-white text-red-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <Skull size={16} />
            Monsters ({filteredMonsters.length})
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="border-b border-gray-200 bg-gray-50 p-4">
        <div className="flex gap-4">
          <div className="relative flex-1">
            {isSearching ? (
              <Loader2
                size={16}
                className="absolute top-1/2 left-3 -translate-y-1/2 transform animate-spin text-blue-500"
              />
            ) : (
              <Search
                size={16}
                className="absolute top-1/2 left-3 -translate-y-1/2 transform text-gray-400"
              />
            )}
            <input
              type="text"
              placeholder={`Search ${activeTab}... (${activeTab === 'monsters' ? `${monsters.length} available` : 'type to search'})`}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-gray-300 py-2 pr-4 pl-10 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            />
            {activeTab === 'monsters' && filteredMonsters.length > 0 && (
              <div className="absolute top-1/2 right-3 -translate-y-1/2 transform text-xs text-gray-500">
                {filteredMonsters.length} results
              </div>
            )}
          </div>

          {activeTab === 'monsters' && (
            <>
              <select
                value={crFilter}
                onChange={e => setCRFilter(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All CRs</option>
                {getUniqueValues('cr').map(cr => (
                  <option key={cr} value={cr}>
                    CR {cr}
                  </option>
                ))}
              </select>

              <select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Types</option>
                {getUniqueValues('type').map(type => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'players' ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {filteredPlayers.map(player => (
              <div
                key={player.id}
                onClick={() => handlePlayerToggle(player.id)}
                className={`cursor-pointer rounded-lg border-2 p-4 transition-colors ${
                  selectedPlayers.includes(player.id)
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Crown size={16} className="text-blue-600" />
                    <div>
                      <h4 className="font-medium text-gray-900">
                        {player.characterData.name}
                      </h4>
                      <p className="text-sm text-gray-600">
                        Level {player.characterData.level}{' '}
                        {player.characterData.class?.name}
                      </p>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">
                    HP: {player.characterData.hitPoints.current}/
                    {player.characterData.hitPoints.max}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {filteredMonsters.length > 100 ? (
              // Use virtualized grid for large datasets
              <VirtualizedMonsterGrid
                monsters={filteredMonsters}
                onAddMonster={handleMonsterToggle}
                selectedMonsters={selectedMonsters}
                monsterQuantities={monsterQuantities}
                onQuantityChange={handleQuantityChange}
                containerWidth={900} // Increased modal width
                containerHeight={500} // Increased height for better virtualization
                loading={loading}
              />
            ) : (
              // Use simple grid for smaller datasets (more reliable)
              <div className="grid max-h-96 grid-cols-1 gap-4 overflow-y-auto md:grid-cols-2 lg:grid-cols-3">
                {filteredMonsters.map(monster => {
                  const isSelected = selectedMonsters.some(
                    m => m.id === monster.id
                  );
                  const quantity = monsterQuantities[monster.id] || 1;

                  return (
                    <div
                      key={monster.id}
                      className={`cursor-pointer rounded-lg border-2 p-4 transition-colors ${
                        isSelected
                          ? 'border-red-500 bg-red-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => handleMonsterToggle(monster)}
                    >
                      <div className="mb-2 flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <Skull size={16} className="text-red-600" />
                          <h4 className="font-medium text-gray-900">
                            {monster.name}
                          </h4>
                        </div>
                        <span className="rounded bg-purple-100 px-2 py-1 text-xs font-medium text-purple-800">
                          CR {monster.cr}
                        </span>
                      </div>

                      <div className="space-y-1 text-sm text-gray-600">
                        <p>{formatMonsterType(monster)}</p>
                        <p>
                          AC {monster.ac.match(/(\d+)/)?.[1] || '?'} • HP{' '}
                          {monster.hp.match(/(\d+)/)?.[1] || '?'}
                        </p>
                      </div>

                      {isSelected && (
                        <div className="mt-3 border-t border-red-200 pt-3">
                          <div className="flex items-center gap-2">
                            <label className="text-sm font-medium text-red-700">
                              Quantity:
                            </label>
                            <input
                              type="number"
                              min="1"
                              max="20"
                              value={quantity}
                              onChange={e =>
                                handleQuantityChange(
                                  monster.id,
                                  parseInt(e.target.value)
                                )
                              }
                              className="w-16 rounded border border-red-300 px-2 py-1 text-center focus:ring-2 focus:ring-red-500"
                              onClick={e => e.stopPropagation()}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 bg-gray-50 p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {activeTab === 'players'
              ? `${selectedPlayers.length} players selected`
              : `${selectedMonsters.reduce((sum, monster) => sum + (monsterQuantities[monster.id] || 1), 0)} monsters selected`}
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 transition-colors hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleAddParticipants}
              disabled={
                (activeTab === 'players' && selectedPlayers.length === 0) ||
                (activeTab === 'monsters' && selectedMonsters.length === 0)
              }
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
            >
              <Plus size={16} />
              Add to Combat
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
