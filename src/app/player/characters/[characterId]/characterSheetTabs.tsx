import React from 'react';
import { TabContent } from "@/components/ui/layout/GroupedTabs";
import ErrorBoundary from "@/components/ui/feedback/ErrorBoundary";
import ConditionsDiseasesManager from "@/components/ui/game/ConditionsDiseasesManager";
import CharacterBackgroundEditor from "@/components/ui/character/CharacterBackgroundEditor";
import FeaturesTraitsManager from "@/components/ui/game/FeaturesTraitsManager";
import NotesManager from "@/components/ui/game/NotesManager";
import InventoryManager from "@/components/ui/game/InventoryManager";
import CurrencyManager from "@/components/ui/game/CurrencyManager";
import { SpellcastingStats } from "@/components/SpellcastingStats";
import { SpellManagement } from "@/components/SpellManagement";
import { WeaponInventory } from "@/components/WeaponInventory";
import ArmorDefenseManager from "@/components/ArmorDefenseManager";
import { CharacterState, RichTextContent, CharacterBackground } from "@/types/character";

interface CharacterSheetTabsConfig {
  character: CharacterState;
  hasHydrated: boolean;
  addFeature: (item: Omit<RichTextContent, "id" | "createdAt" | "updatedAt">) => void;
  updateFeature: (id: string, updates: Partial<RichTextContent>) => void;
  deleteFeature: (id: string) => void;
  addTrait: (item: Omit<RichTextContent, "id" | "createdAt" | "updatedAt">) => void;
  updateTrait: (id: string, updates: Partial<RichTextContent>) => void;
  deleteTrait: (id: string) => void;
  updateCharacterBackground: (updates: Partial<CharacterBackground>) => void;
  addNote: (item: Omit<RichTextContent, "id" | "createdAt" | "updatedAt">) => void;
  updateNote: (id: string, updates: Partial<RichTextContent>) => void;
  deleteNote: (id: string) => void;
  reorderNotes: (sourceIndex: number, destinationIndex: number) => void;
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
  reorderNotes
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
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Spellcasting Statistics */}
              <ErrorBoundary fallback={
                <div className="bg-white rounded-lg shadow border border-purple-200 p-4">
                  <h3 className="text-lg font-bold text-purple-800 mb-4">Spellcasting Stats</h3>
                  <p className="text-gray-500">Unable to load spellcasting statistics</p>
                </div>
              }>
                <SpellcastingStats />
              </ErrorBoundary>

              {/* Spell Management */}
              <ErrorBoundary fallback={
                <div className="bg-white rounded-lg shadow border border-purple-200 p-4">
                  <h3 className="text-lg font-bold text-purple-800 mb-4">Spells & Cantrips</h3>
                  <p className="text-gray-500">Unable to load spell management</p>
                </div>
              }>
                <SpellManagement />
              </ErrorBoundary>
            </div>
          </TabContent>
        )
      },
      {
        id: 'equipment',
        label: 'Equipment',
        icon: '🛡️',
        content: (
          <TabContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Weapons */}
              <ErrorBoundary fallback={
                <div className="bg-white rounded-lg shadow border border-purple-200 p-4">
                  <h3 className="text-lg font-bold text-purple-800 mb-4 flex items-center gap-2">
                    <span className="text-red-600">⚔️</span>
                    Weapons
                  </h3>
                  <p className="text-gray-500">Unable to load weapon inventory</p>
                </div>
              }>
                <WeaponInventory />
              </ErrorBoundary>

              {/* Armor & Defense */}
              <ErrorBoundary fallback={
                <div className="bg-white rounded-lg shadow border border-purple-200 p-4">
                  <h3 className="text-lg font-bold text-purple-800 mb-4 flex items-center gap-2">
                    <span className="text-blue-600">🛡️</span>
                    Armor & Defense
                  </h3>
                  <p className="text-gray-500">Unable to load armor management</p>
                </div>
              }>
                <ArmorDefenseManager />
              </ErrorBoundary>
            </div>
          </TabContent>
        )
      },
      {
        id: 'conditions',
        label: 'Conditions & Diseases',
        icon: '🤒',
        content: (
          <TabContent>
            <ErrorBoundary fallback={
              <div className="bg-white rounded-lg shadow-lg border border-red-200 p-6">
                <h3 className="text-lg font-bold text-red-800 mb-4">Conditions & Diseases</h3>
                <p className="text-gray-500">Unable to load conditions and diseases manager</p>
              </div>
            }>
              {hasHydrated ? (
                <ConditionsDiseasesManager />
              ) : (
                <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-2 text-gray-600">Loading conditions and diseases...</p>
                  </div>
                </div>
              )}
            </ErrorBoundary>
          </TabContent>
        )
      }
    ]
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
              <ErrorBoundary fallback={
                <div className="bg-white rounded-lg shadow-lg border border-purple-200 p-6">
                  <h3 className="text-lg font-bold text-purple-800 mb-4">Inventory</h3>
                  <p className="text-gray-500">Unable to load inventory management</p>
                </div>
              }>
                <InventoryManager />
              </ErrorBoundary>
            </div>
          </TabContent>
        )
      },
      {
        id: 'currency',
        label: 'Currency',
        icon: '💰',
        content: (
          <TabContent>
            <div className="max-w-4xl mx-auto">
              <ErrorBoundary fallback={
                <div className="bg-white rounded-lg shadow-lg border border-yellow-200 p-6">
                  <h3 className="text-lg font-bold text-amber-800 mb-4">Currency</h3>
                  <p className="text-gray-500">Unable to load currency management</p>
                </div>
              }>
                <CurrencyManager />
              </ErrorBoundary>
            </div>
          </TabContent>
        )
      }
    ]
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
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-2 gap-6">
              {/* Features */}
              <ErrorBoundary fallback={
                <div className="bg-white rounded-lg shadow-lg border border-amber-200 p-6">
                  <h3 className="text-lg font-bold text-amber-800 mb-4">Features</h3>
                  <p className="text-gray-500">Unable to load features editor</p>
                </div>
              }>
                <FeaturesTraitsManager
                  items={character.features}
                  category="feature"
                  onAdd={addFeature}
                  onUpdate={updateFeature}
                  onDelete={deleteFeature}
                />
              </ErrorBoundary>

              {/* Traits */}
              <ErrorBoundary fallback={
                <div className="bg-white rounded-lg shadow-lg border border-emerald-200 p-6">
                  <h3 className="text-lg font-bold text-emerald-800 mb-4">Traits</h3>
                  <p className="text-gray-500">Unable to load traits editor</p>
                </div>
              }>
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
                <ErrorBoundary fallback={
                  <div className="bg-white rounded-lg shadow-lg border border-emerald-200 p-6">
                    <h3 className="text-lg font-bold text-emerald-800 mb-4">Character Background</h3>
                    <p className="text-gray-500">Unable to load background editor</p>
                  </div>
                }>
                  <CharacterBackgroundEditor
                    background={character.characterBackground}
                    onChange={updateCharacterBackground}
                  />
                </ErrorBoundary>
              </div>
            </div>
          </TabContent>
        )
      },
      {
        id: 'notes',
        label: 'Session Notes',
        icon: '📝',
        content: (
          <TabContent>
            <div className="max-w-none">
              <ErrorBoundary fallback={
                <div className="bg-white rounded-lg shadow-lg border border-blue-200 p-6">
                  <h3 className="text-lg font-bold text-blue-800 mb-4">Notes</h3>
                  <p className="text-gray-500">Unable to load notes editor</p>
                </div>
              }>
                <NotesManager
                  items={character.notes}
                  onAdd={addNote}
                  onUpdate={updateNote}
                  onDelete={deleteNote}
                  onReorder={reorderNotes}
                />
              </ErrorBoundary>
            </div>
          </TabContent>
        )
      }
    ]
  }
];
