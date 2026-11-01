'use client';

import { useCallback } from 'react';
import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@/components/ui/feedback/dialog';
import { Button } from '@/components/ui/forms/button';
import { cn } from '@/utils/cn';
import { calculateModifier } from '@/utils/calculations';
import { useCharacterStore } from '@/store/characterStore';
import { useLevelUpWizard } from './LevelUpWizard.hooks';
import EditionPickerStep from './steps/EditionPickerStep';
import ClassPickerStep from './steps/ClassPickerStep';
import SubclassSelectionStep from './steps/SubclassSelectionStep';
import SubclassMigrationStep from './steps/SubclassMigrationStep';
import FeaturesSummaryStep from './steps/FeaturesSummaryStep';
import ASIFeatStep from './steps/ASIFeatStep';
import HPStep from './steps/HPStep';
import ConfirmationStep from './steps/ConfirmationStep';

interface LevelUpWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LevelUpWizard({ isOpen, onClose }: LevelUpWizardProps) {
  const character = useCharacterStore(s => s.character);
  const wizard = useLevelUpWizard(character);

  const handleApply = useCallback(() => {
    if (wizard.applyLevelUp()) onClose();
  }, [wizard, onClose]);

  if (wizard.loading) {
    return (
      <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
        <DialogContent size="md" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Level up</DialogTitle>
          <div className="flex items-center justify-center py-16">
            <Loader2
              size={24}
              className="text-muted motion-safe:animate-spin"
            />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const { state, currentStep } = wizard;
  const isLastStep = state.currentStepIndex === state.steps.length - 1;
  const isFirstStep = state.currentStepIndex === 0;

  const activeSubclassName =
    state.subclassMigration?.selectedSubclass?.shortName ||
    state.selectedSubclass?.shortName ||
    state.targetClass?.subclass ||
    undefined;

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent size="md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>
            {state.targetClass
              ? `Level up — ${state.targetClass.className} ${state.targetClass.level} → ${state.newClassLevel}`
              : 'Level up'}
          </DialogTitle>
        </DialogHeader>

        {/* Step indicators */}
        {state.steps.length > 1 && (
          <ol className="border-divider flex flex-wrap gap-x-4 gap-y-2 border-b pb-3">
            {state.steps.map((step, i) => (
              <li
                key={step.id}
                className="flex min-w-0 items-center gap-1.5"
                aria-current={i === state.currentStepIndex ? 'step' : undefined}
              >
                <span
                  className={cn(
                    'type-caption flex size-6 shrink-0 items-center justify-center rounded-full border',
                    i < state.currentStepIndex
                      ? 'border-divider-strong text-heading'
                      : i === state.currentStepIndex
                        ? 'border-brass-border text-brass-text'
                        : 'border-divider text-muted'
                  )}
                >
                  {i < state.currentStepIndex ? <Check size={12} /> : i + 1}
                </span>
                <span
                  className={cn(
                    'type-caption',
                    i === state.currentStepIndex
                      ? 'text-heading font-medium'
                      : 'text-muted'
                  )}
                >
                  {step.label}
                </span>
              </li>
            ))}
          </ol>
        )}

        <DialogBody className="min-h-[300px]">
          {currentStep?.id === 'edition' && (
            <EditionPickerStep
              editionOptions={wizard.editionOptions}
              selectedEdition={state.selectedEdition}
              onSelect={wizard.setSelectedEdition}
            />
          )}

          {currentStep?.id === 'class' && (
            <ClassPickerStep
              classes={wizard.classes}
              selectedIndex={state.targetClassIndex}
              onSelect={wizard.setTargetClassIndex}
            />
          )}

          {currentStep?.id === 'subclass-migration' && (
            <SubclassMigrationStep
              className={state.targetClass?.className || ''}
              currentLevel={state.targetClass?.level || 0}
              subclasses={wizard.availableSubclasses}
              selectedSubclass={state.subclassMigration.selectedSubclass}
              onSelectSubclass={wizard.setMigrationSubclass}
              missedFeatures={state.subclassMigration.missedFeatures}
              missedSpellGrants={state.subclassMigration.missedSpellGrants}
              onToggleFeature={key => {
                wizard.setMigrationAdoptedFeatures(prev => {
                  const next = new Set(prev);
                  if (next.has(key)) {
                    next.delete(key);
                  } else {
                    next.add(key);
                  }
                  return next;
                });
              }}
            />
          )}

          {currentStep?.id === 'subclass' && state.matchedClass && (
            <SubclassSelectionStep
              className={state.targetClass?.className || ''}
              subclasses={wizard.availableSubclasses}
              selectedSubclass={state.selectedSubclass}
              onSelect={wizard.setSelectedSubclass}
            />
          )}

          {currentStep?.id === 'features' && (
            <FeaturesSummaryStep
              className={state.targetClass?.className || ''}
              newLevel={state.newClassLevel}
              features={state.features}
              subclassFeatures={state.subclassFeatures}
              subclassName={activeSubclassName}
              subclassSpellGrants={state.subclassSpellGrants}
              featureChoices={state.featureChoices}
              onFeatureChoiceChange={(featureName, optionName) =>
                wizard.setFeatureChoices(prev => ({
                  ...prev,
                  [featureName]: optionName,
                }))
              }
            />
          )}

          {currentStep?.id === 'asi' && (
            <ASIFeatStep
              abilities={character.abilities}
              asiChoice={state.asiChoice}
              onChoiceChange={wizard.setASIChoice}
              allSpells={wizard.allSpells}
              spellsLoading={false}
              newTotalLevel={state.newTotalLevel}
            />
          )}

          {currentStep?.id === 'hp' && state.targetClass && (
            <HPStep
              hitDie={state.targetClass.hitDie}
              constitutionScore={wizard.prospectiveConstitution}
              hpRollResult={state.hpRollResult}
              hpGained={wizard.hpPreview?.gained}
              onRollResultChange={wizard.setHPRollResult}
            />
          )}

          {currentStep?.id === 'confirm' && state.targetClass && (
            <ConfirmationStep
              className={state.targetClass.className}
              oldClassLevel={state.targetClass.level}
              newClassLevel={state.newClassLevel}
              oldTotalLevel={wizard.totalLevel}
              newTotalLevel={state.newTotalLevel}
              selectedSubclass={
                state.subclassMigration?.selectedSubclass?.shortName ||
                state.selectedSubclass?.shortName
              }
              features={state.features}
              subclassFeatures={state.subclassFeatures}
              subclassSpellGrants={state.subclassSpellGrants}
              migrationFeatures={state.subclassMigration.missedFeatures
                .filter(item => item.adopted)
                .map(item => item.feature)}
              migrationSpellGrants={state.subclassMigration.missedSpellGrants}
              asiChoice={state.asiChoice}
              abilities={character.abilities}
              hpRollResult={state.hpRollResult}
              hitDie={state.targetClass.hitDie}
              conModifier={calculateModifier(wizard.prospectiveConstitution)}
              hpGained={wizard.hpPreview?.gained}
              isCustomClass={state.isCustomClass}
              spellsKnownDelta={wizard.spellsKnownDelta}
              cantripsKnownDelta={wizard.cantripsKnownDelta}
              cantripUpgrades={wizard.cantripUpgrades}
            />
          )}
        </DialogBody>

        <DialogFooter>
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            <div>
              {!isFirstStep && (
                <Button variant="ghost" onClick={wizard.goBack}>
                  <ArrowLeft size={14} className="mr-1" />
                  Back
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              {isLastStep ? (
                <Button variant="primary" onClick={handleApply}>
                  <Check size={14} className="mr-1" />
                  Level up
                </Button>
              ) : (
                <Button
                  variant="primary"
                  onClick={wizard.goNext}
                  disabled={!wizard.canGoNext}
                >
                  Next
                  <ArrowRight size={14} className="ml-1" />
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
