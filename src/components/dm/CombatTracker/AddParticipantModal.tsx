'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Skull, 
  Search, 
  Plus, 
  Crown,
  Loader2
} from 'lucide-react';
import { CombatParticipant } from '@/types/combat';
import { ProcessedMonster } from '@/types/bestiary';
import { useDMStore } from '@/store/dmStore';
import { useCombatStore } from '@/store/combatStore';
import { monsterToCombatParticipant, formatMonsterType, parseChallengeRating } from '@/utils/dm/monsterUtils';

interface AddParticipantModalProps {
  campaignId: string;
  onClose: () => void;
}

type TabMode = 'players' | 'monsters';

export function AddParticipantModal({
  campaignId,
  onClose
}: AddParticipantModalProps) {
  const [activeTab, setActiveTab] = useState<TabMode>('players');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [selectedMonsters, setSelectedMonsters] = useState<ProcessedMonster[]>([]);
  const [monsterQuantities, setMonsterQuantities] = useState<Record<string, number>>({});
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
        // TODO: Replace with actual bestiary data loading
        // For now, create some sample monsters
        const sampleMonsters: ProcessedMonster[] = [
          {
            id: 'goblin',
            name: 'Goblin',
            size: ['Small'],
            type: 'humanoid',
            alignment: 'Neutral Evil',
            ac: '15 (Leather Armor, Shield)',
            hp: '7 (2d6)',
            speed: '30 ft.',
            str: 8,
            dex: 14,
            con: 10,
            int: 10,
            wis: 8,
            cha: 8,
            saves: '',
            skills: 'Stealth +6',
            resistances: '',
            immunities: '',
            vulnerabilities: '',
            senses: 'darkvision 60 ft.',
            passivePerception: 9,
            languages: 'Common, Goblin',
            cr: '1/4',
            source: 'MM',
            page: 166
          },
          {
            id: 'orc',
            name: 'Orc',
            size: ['Medium'],
            type: 'humanoid',
            alignment: 'Chaotic Evil',
            ac: '13 (Hide Armor)',
            hp: '15 (2d8 + 2)',
            speed: '30 ft.',
            str: 16,
            dex: 12,
            con: 13,
            int: 7,
            wis: 11,
            cha: 10,
            saves: '',
            skills: '',
            resistances: '',
            immunities: '',
            vulnerabilities: '',
            senses: 'darkvision 60 ft.',
            passivePerception: 10,
            languages: 'Common, Orc',
            cr: '1/2',
            source: 'MM',
            page: 246
          },
          {
            id: 'owlbear',
            name: 'Owlbear',
            size: ['Large'],
            type: 'monstrosity',
            alignment: 'Unaligned',
            ac: '13 (Natural Armor)',
            hp: '59 (7d10 + 21)',
            speed: '40 ft.',
            str: 20,
            dex: 12,
            con: 17,
            int: 3,
            wis: 12,
            cha: 7,
            saves: '',
            skills: 'Perception +3',
            resistances: '',
            immunities: '',
            vulnerabilities: '',
            senses: 'darkvision 60 ft.',
            passivePerception: 13,
            languages: '',
            cr: '3',
            source: 'MM',
            page: 249
          }
        ];
        setMonsters(sampleMonsters);
      } catch (error) {
        console.error('Failed to load monsters:', error);
      } finally {
        setLoading(false);
      }
    };

    if (activeTab === 'monsters') {
      loadMonsters();
    }
  }, [activeTab]);

  // Filter players based on search
  const filteredPlayers = campaign?.playerCharacters.filter(pc => 
    pc.characterData.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pc.characterData.class?.name.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  // Filter monsters based on search and filters
  const filteredMonsters = monsters.filter(monster => {
    const matchesSearch = monster.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         monster.type.toString().toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCR = !crFilter || monster.cr === crFilter;
    const matchesType = !typeFilter || 
                       (typeof monster.type === 'string' ? monster.type : monster.type.type) === typeFilter;

    return matchesSearch && matchesCR && matchesType;
  });

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
    setMonsterQuantities(prev => ({ ...prev, [monsterId]: Math.max(1, quantity) }));
  };

  const handleAddParticipants = () => {
    // Add selected players
    selectedPlayers.forEach(playerId => {
      const playerCharacter = campaign?.playerCharacters.find(pc => pc.id === playerId);
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
          dexterityModifier: Math.floor((playerCharacter.characterData.abilities?.dexterity || 10 - 10) / 2),
          position: { x: 0, y: 0 },
          conditions: [],
          characterReference: {
            campaignId,
            characterId: playerCharacter.id,
            characterData: playerCharacter.characterData
          }
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
    const values = monsters.map(monster => {
      if (field === 'type') {
        return typeof monster.type === 'string' ? monster.type : monster.type.type;
      }
      return monster[field];
    });
    return [...new Set(values)].sort((a, b) => {
      if (field === 'cr') {
        return parseChallengeRating(a) - parseChallengeRating(b);
      }
      return a.localeCompare(b);
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-gray-900">Add Participants to Combat</h3>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex mt-4 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('players')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md transition-colors ${
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
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md transition-colors ${
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
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder={`Search ${activeTab}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {activeTab === 'monsters' && (
              <>
                <select
                  value={crFilter}
                  onChange={(e) => setCRFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All CRs</option>
                  {getUniqueValues('cr').map(cr => (
                    <option key={cr} value={cr}>CR {cr}</option>
                  ))}
                </select>

                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Types</option>
                  {getUniqueValues('type').map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'players' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredPlayers.map(player => (
                <div
                  key={player.id}
                  onClick={() => handlePlayerToggle(player.id)}
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                    selectedPlayers.includes(player.id)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Crown size={16} className="text-blue-600" />
                      <div>
                        <h4 className="font-medium text-gray-900">{player.characterData.name}</h4>
                        <p className="text-sm text-gray-600">
                          Level {player.characterData.level} {player.characterData.class?.name}
                        </p>
                      </div>
                    </div>
                    <div className="text-sm text-gray-500">
                      HP: {player.characterData.hitPoints.current}/{player.characterData.hitPoints.max}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={32} className="animate-spin text-gray-400" />
                  <span className="ml-3 text-gray-600">Loading monsters...</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredMonsters.map(monster => {
                    const isSelected = selectedMonsters.some(m => m.id === monster.id);
                    const quantity = monsterQuantities[monster.id] || 1;

                    return (
                      <div
                        key={monster.id}
                        className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                          isSelected
                            ? 'border-red-500 bg-red-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div onClick={() => handleMonsterToggle(monster)}>
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Skull size={16} className="text-red-600" />
                              <h4 className="font-medium text-gray-900">{monster.name}</h4>
                            </div>
                            <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded">
                              CR {monster.cr}
                            </span>
                          </div>
                          
                          <div className="text-sm text-gray-600 space-y-1">
                            <p>{formatMonsterType(monster)}</p>
                            <p>AC {monster.ac.match(/(\d+)/)?.[1] || '?'} • HP {monster.hp.match(/(\d+)/)?.[1] || '?'}</p>
                          </div>
                        </div>

                        {isSelected && (
                          <div className="mt-3 pt-3 border-t border-red-200">
                            <div className="flex items-center gap-2">
                              <label className="text-sm font-medium text-red-700">Quantity:</label>
                              <input
                                type="number"
                                min="1"
                                max="20"
                                value={quantity}
                                onChange={(e) => handleQuantityChange(monster.id, parseInt(e.target.value))}
                                className="w-16 px-2 py-1 border border-red-300 rounded text-center focus:ring-2 focus:ring-red-500"
                                onClick={(e) => e.stopPropagation()}
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
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {activeTab === 'players' 
                ? `${selectedPlayers.length} players selected`
                : `${selectedMonsters.reduce((sum, monster) => sum + (monsterQuantities[monster.id] || 1), 0)} monsters selected`
              }
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddParticipants}
                disabled={(activeTab === 'players' && selectedPlayers.length === 0) || 
                         (activeTab === 'monsters' && selectedMonsters.length === 0)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                <Plus size={16} />
                Add to Combat
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
