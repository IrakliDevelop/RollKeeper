'use client';

import React, { useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Edit3,
  Eye,
  Plus,
  Star,
  Trash2,
} from 'lucide-react';
import {
  CharacterState,
  ExtendedFeature,
  FEATURE_SOURCE_LABELS,
  Spell,
} from '@/types/character';
import { calculateTraitMaxUses } from '@/utils/calculations';
import { confirmDialog } from '@/components/ui/feedback/confirm-dialog';
import { Button, Input } from '@/components/ui/forms';
import { Section } from '@/components/ui/layout/section';
import DragDropList from '@/components/ui/layout/DragDropList';
import UnifiedFeatureModal from './UnifiedFeatureModal';

interface ExtendedFeaturesSectionProps {
  features: ExtendedFeature[];
  character: CharacterState;
  onAddFeature: (
    feature: Omit<ExtendedFeature, 'id' | 'createdAt' | 'updatedAt'>
  ) => void;
  onUpdateFeature: (id: string, updates: Partial<ExtendedFeature>) => void;
  onDeleteFeature: (id: string) => void;
  onUseFeature: (id: string) => void;
  onResetFeatures: (restType: 'short' | 'long') => void;
  onReorderFeatures: (sourceId: string, targetId: string) => void;
  onAddSpells?: (spells: Spell[]) => void;
  favoriteFeatureIds?: string[];
  onToggleFavoriteFeature?: (id: string) => void;
  editing?: boolean;
  readonly?: boolean;
  className?: string;
}

export default function ExtendedFeaturesSection({
  features,
  character,
  onAddFeature,
  onUpdateFeature,
  onDeleteFeature,
  onUseFeature,
  onResetFeatures,
  onReorderFeatures,
  onAddSpells,
  favoriteFeatureIds = [],
  onToggleFavoriteFeature,
  editing = false,
  readonly = false,
  className = '',
}: ExtendedFeaturesSectionProps) {
  const [query, setQuery] = useState('');
  const [modalFeature, setModalFeature] = useState<ExtendedFeature | null>(
    null
  );
  const [modalMode, setModalMode] = useState<'view' | 'edit'>('view');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const orderedFeatures = features;
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleFeatures = normalizedQuery
    ? orderedFeatures.filter(feature =>
        [
          feature.name,
          feature.description,
          feature.source,
          feature.sourceDetail,
          FEATURE_SOURCE_LABELS[feature.sourceType],
        ].some(value =>
          value
            ?.replace(/<[^>]+>/g, ' ')
            .toLocaleLowerCase()
            .includes(normalizedQuery)
        )
      )
    : orderedFeatures;

  const openFeature = (feature: ExtendedFeature, mode: 'view' | 'edit') => {
    setModalFeature(feature);
    setModalMode(mode);
  };

  const deleteFeature = (feature: ExtendedFeature) => {
    void confirmDialog({
      title: `Delete ${feature.name}?`,
      confirmLabel: 'Delete feature',
      cancelLabel: 'Cancel',
      tone: 'danger',
    }).then(confirmed => {
      if (confirmed) {
        onDeleteFeature(feature.id);
        setModalFeature(null);
        addButtonRef.current?.focus();
      }
    });
  };

  return (
    <Section
      heading="Character Features"
      className={className}
      trailing={
        !readonly && (
          <Button
            ref={addButtonRef}
            type="button"
            variant="primary"
            size="sm"
            leftIcon={<Plus className="size-4" />}
            onClick={() => setIsAddModalOpen(true)}
          >
            Add feature
          </Button>
        )
      }
    >
      {features.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-heading font-medium">No features yet</p>
          <p className="text-muted mt-1 text-sm">
            Class features, racial traits and feats you add appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <Input
            type="search"
            aria-label="Search features"
            placeholder="Search features"
            value={query}
            onChange={event => setQuery(event.target.value)}
          />
          {visibleFeatures.length === 0 && (
            <p className="text-muted py-6 text-center text-sm">
              No features match “{query.trim()}”.
            </p>
          )}
          {visibleFeatures.length > 0 && (
            <DragDropList
              items={visibleFeatures}
              keyExtractor={feature => feature.id}
              onReorder={(sourceIndex, targetIndex) => {
                const source = visibleFeatures[sourceIndex];
                const target = visibleFeatures[targetIndex];
                if (source && target) onReorderFeatures(source.id, target.id);
              }}
              disabled={readonly || Boolean(query)}
              showDragHandle={!readonly && !query}
              dragHandlePosition="right"
              className="divide-divider border-divider divide-y border-y"
              renderItem={(feature, index) => {
                const maxUses = calculateTraitMaxUses(feature, character.level);
                const usedUses = Math.min(
                  Math.max(feature.usedUses, 0),
                  maxUses
                );
                return (
                  <div
                    data-feature-row={feature.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3 pr-7 sm:flex-nowrap"
                  >
                    <div className="min-w-0 flex-1 basis-full sm:basis-0">
                      <p
                        id={`feature-name-${feature.id}`}
                        className="text-heading font-medium break-words"
                      >
                        {feature.name}
                      </p>
                      <p className="text-muted text-sm break-words">
                        {feature.sourceDetail ||
                          feature.source ||
                          FEATURE_SOURCE_LABELS[feature.sourceType]}
                      </p>
                    </div>
                    {feature.isPassive ? (
                      <span className="text-muted text-sm">Passive</span>
                    ) : maxUses === 0 ? (
                      <span className="text-muted text-sm">Unlimited</span>
                    ) : (
                      <span className="text-muted text-sm">
                        {maxUses - usedUses}/{maxUses}
                      </span>
                    )}
                    {!feature.isPassive && maxUses > 0 && (
                      <div className="flex min-w-0 flex-wrap items-center gap-1">
                        {Array.from({ length: maxUses }, (_, pipIndex) => {
                          const spent = pipIndex >= maxUses - usedUses;
                          return (
                            <button
                              key={pipIndex}
                              type="button"
                              aria-label={`${spent ? 'Restore' : 'Spend'} a use of ${feature.name}`}
                              disabled={readonly}
                              onClick={() =>
                                onUpdateFeature(feature.id, {
                                  usedUses: spent ? usedUses - 1 : usedUses + 1,
                                })
                              }
                              className={`focus-visible:outline-ring flex size-8 items-center justify-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 pointer-coarse:size-11 ${spent ? 'text-muted' : 'text-brass-text'}`}
                            >
                              <span
                                aria-hidden="true"
                                className={`size-3 rounded-full border border-current ${spent ? '' : 'bg-current'}`}
                              />
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {!feature.isPassive && maxUses > 0 && (
                      <span className="text-muted text-sm capitalize">
                        {feature.restType}
                      </span>
                    )}
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={`Open ${feature.name}`}
                        onClick={() => openFeature(feature, 'view')}
                      >
                        <Eye className="size-4" aria-hidden="true" />
                      </Button>
                      {onToggleFavoriteFeature && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          aria-label="Add to quick actions"
                          aria-describedby={`feature-name-${feature.id}`}
                          aria-pressed={favoriteFeatureIds.includes(feature.id)}
                          onClick={() => onToggleFavoriteFeature(feature.id)}
                        >
                          <Star className="size-4" aria-hidden="true" />
                        </Button>
                      )}
                      {!readonly && (
                        <>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            aria-label="Edit feature"
                            aria-describedby={`feature-name-${feature.id}`}
                            onClick={() => openFeature(feature, 'edit')}
                          >
                            <Edit3 className="size-4" aria-hidden="true" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            aria-label="Delete feature"
                            aria-describedby={`feature-name-${feature.id}`}
                            onClick={() => deleteFeature(feature)}
                          >
                            <Trash2 className="size-4" aria-hidden="true" />
                          </Button>
                        </>
                      )}
                    </div>
                    {editing && !readonly && (
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          aria-label="Move up"
                          aria-describedby={`feature-name-${feature.id}`}
                          disabled={index === 0}
                          onClick={() =>
                            onReorderFeatures(
                              feature.id,
                              visibleFeatures[index - 1].id
                            )
                          }
                        >
                          <ArrowUp className="size-4" aria-hidden="true" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          aria-label="Move down"
                          aria-describedby={`feature-name-${feature.id}`}
                          disabled={index === visibleFeatures.length - 1}
                          onClick={() =>
                            onReorderFeatures(
                              feature.id,
                              visibleFeatures[index + 1].id
                            )
                          }
                        >
                          <ArrowDown className="size-4" aria-hidden="true" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              }}
            />
          )}
          {!readonly && features.some(feature => feature.usedUses > 0) && (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onResetFeatures('short')}
              >
                Reset short rest uses
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onResetFeatures('long')}
              >
                Reset all uses
              </Button>
            </div>
          )}
        </div>
      )}
      <UnifiedFeatureModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSave={onAddFeature}
        onAddSpells={onAddSpells}
        existingFeatures={features}
        character={character}
      />
      <UnifiedFeatureModal
        isOpen={modalFeature !== null}
        onClose={() => setModalFeature(null)}
        onSave={updates => {
          if (modalFeature) onUpdateFeature(modalFeature.id, updates);
        }}
        onAddSpells={onAddSpells}
        onDelete={modalFeature ? () => deleteFeature(modalFeature) : undefined}
        onUse={modalFeature ? () => onUseFeature(modalFeature.id) : undefined}
        existingFeatures={features}
        feature={modalFeature ?? undefined}
        initialMode={modalMode}
        character={character}
      />
    </Section>
  );
}
