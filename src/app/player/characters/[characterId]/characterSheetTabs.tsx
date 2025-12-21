import React from 'react';
import { TabContent } from '@/components/ui/layout/GroupedTabs';
import ErrorBoundary from '@/components/ui/feedback/ErrorBoundary';
import ConditionsDiseasesManager from '@/components/ui/game/ConditionsDiseasesManager';
import CharacterBackgroundEditor from '@/components/ui/character/CharacterBackgroundEditor';
import FeaturesTraitsManager from '@/components/ui/game/FeaturesTraitsManager';
import NotesManager from '@/components/ui/game/NotesManager';
import InventoryManager from '@/components/ui/game/InventoryManager';
import CurrencyManager from '@/components/ui/game/CurrencyManager';
import { SpellcastingStats } from '@/components/SpellcastingStats';
import { EnhancedSpellManagement } from '@/components/EnhancedSpellManagement';
import EquipmentSection from '@/components/ui/character/EquipmentSection';
import { ToastData } from '@/components/ui/feedback/Toast';
import {
  CharacterState,
  RichTextContent,
  CharacterBackground,
} from '@/types/character';

interface CharacterSheetTabsConfig {
  character: CharacterState;
  hasHydrated: boolean;
  addFeature: (
    item: Omit<RichTextContent, 'id' | 'createdAt' | 'updatedAt'>
  ) => void;
  updateFeature: (id: string, updates: Partial<RichTextContent>) => void;
  deleteFeature: (id: string) => void;
  addTrait: (
    item: Omit<RichTextContent, 'id' | 'createdAt' | 'updatedAt'>
  ) => void;
  updateTrait: (id: string, updates: Partial<RichTextContent>) => void;
  deleteTrait: (id: string) => void;
  updateCharacterBackground: (updates: Partial<CharacterBackground>) => void;
  addNote: (
    item: Omit<RichTextContent, 'id' | 'createdAt' | 'updatedAt'>
  ) => void;
  updateNote: (id: string, updates: Partial<RichTextContent>) => void;
  deleteNote: (id: string) => void;
  reorderNotes: (sourceIndex: number, destinationIndex: number) => void;
  addToast: (toast: Omit<ToastData, 'id'>) => void;
}

export const createCharacterSheetTabsConfig = ({
  character,
  hasHydrated,
  addFeature,
  updateFeature,
  deleteFeature,
  addTrait,
  updateTrait,
  deleteTrait,
  updateCharacterBackground,
  addNote,
  updateNote,
  deleteNote,
  reorderNotes,
  addToast,
}: CharacterSheetTabsConfig) => [
  {
    id: 'combat-magic',
    label: 'Combat & Magic',
    icon: '⚔️',
    defaultOpen: true,
    tabs: [
      {
        id: 'spellcasting',
        label: 'Spellcasting',
        icon: '✨',
        content: (
          <TabContent>
            <div className="space-y-6">
              {/* Spellcasting Statistics - Full Width at Top */}
              <ErrorBoundary
                fallback={
                  <div className="rounded-lg border border-purple-200 bg-white p-4 shadow">
                    <h3 className="mb-4 text-lg font-bold text-purple-800">
                      Spellcasting Stats
                    </h3>
                    <p className="text-gray-500">
                      Unable to load spellcasting statistics
                    </p>
                  </div>
                }
              >
                <SpellcastingStats />
              </ErrorBoundary>

              {/* Enhanced Spell Management - Full Width */}
              <ErrorBoundary
                fallback={
                  <div className="rounded-lg border border-purple-200 bg-white p-4 shadow">
                    <h3 className="mb-4 text-lg font-bold text-purple-800">
                      Spells & Cantrips
                    </h3>
                    <p className="text-gray-500">
                      Unable to load spell management
                    </p>
                  </div>
                }
              >
                <EnhancedSpellManagement />
              </ErrorBoundary>
            </div>
          </TabContent>
        ),
      },
      {
        id: 'equipment',
        label: 'Equipment',
        icon: '🛡️',
        content: (
          <TabContent>
            <EquipmentSection character={character} />
          </TabContent>
        ),
      },
      {
        id: 'conditions',
        label: 'Conditions & Diseases',
        icon: '🤒',
        content: (
          <TabContent>
            <ErrorBoundary
              fallback={
                <div className="rounded-lg border border-red-200 bg-white p-6 shadow-lg">
                  <h3 className="mb-4 text-lg font-bold text-red-800">
                    Conditions & Diseases
                  </h3>
                  <p className="text-gray-500">
                    Unable to load conditions and diseases manager
                  </p>
                </div>
              }
            >
              {hasHydrated ? (
                <ConditionsDiseasesManager />
              ) : (
                <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-lg">
                  <div className="py-4 text-center">
                    <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
                    <p className="mt-2 text-gray-600">
                      Loading conditions and diseases...
                    </p>
                  </div>
                </div>
              )}
            </ErrorBoundary>
          </TabContent>
        ),
      },
    ],
  },
  {
    id: 'items-wealth',
    label: 'Items & Wealth',
    icon: '💰',
    defaultOpen: false,
    tabs: [
      {
        id: 'inventory',
        label: 'Inventory',
        icon: '🎒',
        content: (
          <TabContent>
            <div className="max-w-none">
              <ErrorBoundary
                fallback={
                  <div className="rounded-lg border border-purple-200 bg-white p-6 shadow-lg">
                    <h3 className="mb-4 text-lg font-bold text-purple-800">
                      Inventory
                    </h3>
                    <p className="text-gray-500">
                      Unable to load inventory management
                    </p>
                  </div>
                }
              >
                <InventoryManager />
              </ErrorBoundary>
            </div>
          </TabContent>
        ),
      },
      {
        id: 'currency',
        label: 'Currency',
        icon: '💰',
        content: (
          <TabContent>
            <div className="mx-auto max-w-4xl">
              <ErrorBoundary
                fallback={
                  <div className="rounded-lg border border-yellow-200 bg-white p-6 shadow-lg">
                    <h3 className="mb-4 text-lg font-bold text-amber-800">
                      Currency
                    </h3>
                    <p className="text-gray-500">
                      Unable to load currency management
                    </p>
                  </div>
                }
              >
                <CurrencyManager />
              </ErrorBoundary>
            </div>
          </TabContent>
        ),
      },
    ],
  },
  {
    id: 'character-story',
    label: 'Character & Story',
    icon: '📖',
    defaultOpen: false,
    tabs: [
      {
        id: 'character-details',
        label: 'Character Details',
        icon: '📜',
        content: (
          <TabContent>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-2">
              {/* Features */}
              <ErrorBoundary
                fallback={
                  <div className="rounded-lg border border-amber-200 bg-white p-6 shadow-lg">
                    <h3 className="mb-4 text-lg font-bold text-amber-800">
                      Features
                    </h3>
                    <p className="text-gray-500">
                      Unable to load features editor
                    </p>
                  </div>
                }
              >
                <FeaturesTraitsManager
                  items={character.features}
                  category="feature"
                  onAdd={addFeature}
                  onUpdate={updateFeature}
                  onDelete={deleteFeature}
                />
              </ErrorBoundary>

              {/* Traits */}
              <ErrorBoundary
                fallback={
                  <div className="rounded-lg border border-emerald-200 bg-white p-6 shadow-lg">
                    <h3 className="mb-4 text-lg font-bold text-emerald-800">
                      Traits
                    </h3>
                    <p className="text-gray-500">
                      Unable to load traits editor
                    </p>
                  </div>
                }
              >
                <FeaturesTraitsManager
                  items={character.traits}
                  category="trait"
                  onAdd={addTrait}
                  onUpdate={updateTrait}
                  onDelete={deleteTrait}
                />
              </ErrorBoundary>

              {/* Character Background - Full Width */}
              <div className="lg:col-span-2">
                <ErrorBoundary
                  fallback={
                    <div className="rounded-lg border border-emerald-200 bg-white p-6 shadow-lg">
                      <h3 className="mb-4 text-lg font-bold text-emerald-800">
                        Character Background
                      </h3>
                      <p className="text-gray-500">
                        Unable to load background editor
                      </p>
                    </div>
                  }
                >
                  <CharacterBackgroundEditor
                    background={character.characterBackground}
                    onChange={updateCharacterBackground}
                  />
                </ErrorBoundary>
              </div>
            </div>
          </TabContent>
        ),
      },
      {
        id: 'notes',
        label: 'Session Notes',
        icon: '📝',
        content: (
          <TabContent>
            <div className="max-w-none space-y-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 px-3 py-1 font-medium text-amber-800 shadow-sm">
                  <span className="text-base">📅</span>
                  Campaign Day {character.daysSpent || 0}
                </span>
                <span className="text-gray-400">•</span>
                <span className="text-gray-500">
                  {Math.floor((character.daysSpent || 0) / 7) > 0 ? (
                    <>
                      Week {Math.floor((character.daysSpent || 0) / 7) + 1}
                      {(character.daysSpent || 0) % 7 > 0 &&
                        `, Day ${(character.daysSpent || 0) % 7}`}
                    </>
                  ) : (
                    `Day ${(character.daysSpent || 0) + 1} of the adventure`
                  )}
                </span>
              </div>

              <ErrorBoundary
                fallback={
                  <div className="rounded-lg border border-blue-200 bg-white p-6 shadow-lg">
                    <h3 className="mb-4 text-lg font-bold text-blue-800">
                      Notes
                    </h3>
                    <p className="text-gray-500">Unable to load notes editor</p>
                  </div>
                }
              >
                <NotesManager
                  items={character.notes}
                  onAdd={addNote}
                  onUpdate={updateNote}
                  onDelete={deleteNote}
                  onReorder={reorderNotes}
                  onAddToast={addToast}
                />
              </ErrorBoundary>
            </div>
          </TabContent>
        ),
      },
    ],
  },
];
