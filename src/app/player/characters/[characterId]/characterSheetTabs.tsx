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
                  <div className="border-accent-purple-border bg-surface-raised rounded-lg border p-4 shadow">
                    <h3 className="text-accent-purple-text mb-4 text-lg font-bold">
                      Spellcasting Stats
                    </h3>
                    <p className="text-muted">
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
                  <div className="border-accent-purple-border bg-surface-raised rounded-lg border p-4 shadow">
                    <h3 className="text-accent-purple-text mb-4 text-lg font-bold">
                      Spells & Cantrips
                    </h3>
                    <p className="text-muted">
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
                <div className="border-accent-red-border bg-surface-raised rounded-lg border p-6 shadow-lg">
                  <h3 className="text-accent-red-text mb-4 text-lg font-bold">
                    Conditions & Diseases
                  </h3>
                  <p className="text-muted">
                    Unable to load conditions and diseases manager
                  </p>
                </div>
              }
            >
              {hasHydrated ? (
                <ConditionsDiseasesManager />
              ) : (
                <div className="border-divider bg-surface-raised rounded-lg border p-6 shadow-lg">
                  <div className="py-4 text-center">
                    <div className="border-accent-blue-text-muted mx-auto h-8 w-8 animate-spin rounded-full border-b-2"></div>
                    <p className="text-body mt-2">
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
                  <div className="border-accent-purple-border bg-surface-raised rounded-lg border p-6 shadow-lg">
                    <h3 className="text-accent-purple-text mb-4 text-lg font-bold">
                      Inventory
                    </h3>
                    <p className="text-muted">
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
                  <div className="border-accent-amber-border bg-surface-raised rounded-lg border p-6 shadow-lg">
                    <h3 className="text-accent-amber-text mb-4 text-lg font-bold">
                      Currency
                    </h3>
                    <p className="text-muted">
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
                  <div className="border-accent-amber-border bg-surface-raised rounded-lg border p-6 shadow-lg">
                    <h3 className="text-accent-amber-text mb-4 text-lg font-bold">
                      Features
                    </h3>
                    <p className="text-muted">Unable to load features editor</p>
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
                  <div className="border-accent-emerald-border bg-surface-raised rounded-lg border p-6 shadow-lg">
                    <h3 className="text-accent-emerald-text mb-4 text-lg font-bold">
                      Traits
                    </h3>
                    <p className="text-muted">Unable to load traits editor</p>
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
                    <div className="border-accent-emerald-border bg-surface-raised rounded-lg border p-6 shadow-lg">
                      <h3 className="text-accent-emerald-text mb-4 text-lg font-bold">
                        Character Background
                      </h3>
                      <p className="text-muted">
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
              <div className="text-body flex items-center gap-2 text-sm">
                <span className="border-accent-amber-border text-accent-amber-text inline-flex items-center gap-1.5 rounded-full border bg-gradient-to-r from-[var(--gradient-amber-from)] to-[var(--gradient-amber-to)] px-3 py-1 font-medium shadow-sm">
                  <span className="text-base">📅</span>
                  Campaign Day {character.daysSpent || 0}
                </span>
                <span className="text-faint">•</span>
                <span className="text-muted">
                  {Math.floor((character.daysSpent || 0) / 7) > 0 ? (
                    <>
                      Week {Math.floor((character.daysSpent || 0) / 7) + 1}, Day{' '}
                      {((character.daysSpent || 0) % 7) + 1}
                    </>
                  ) : (
                    `Day ${(character.daysSpent || 0) + 1} of the adventure`
                  )}
                </span>
              </div>

              <ErrorBoundary
                fallback={
                  <div className="border-accent-blue-border bg-surface-raised rounded-lg border p-6 shadow-lg">
                    <h3 className="text-accent-blue-text mb-4 text-lg font-bold">
                      Notes
                    </h3>
                    <p className="text-muted">Unable to load notes editor</p>
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
