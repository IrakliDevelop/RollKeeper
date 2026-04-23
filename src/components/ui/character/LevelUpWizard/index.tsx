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
    wizard.applyLevelUp();
    onClose();
  }, [wizard, onClose]);

  if (wizard.loading) {
    return (
      <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
        <DialogContent size="md">
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="text-muted animate-spin" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const { state, currentStep } = wizard;
  const isLastStep = state.currentStepIndex === state.steps.length - 1;
  const isFirstStep = state.currentStepIndex === 0;

  const activeSubclassName =
    state.selectedSubclass?.shortName ||
    state.targetClass?.subclass ||
    undefined;

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>
            Level Up — {state.targetClass?.className || 'Character'}{' '}
            {state.targetClass &&
              `${state.targetClass.level} → ${state.newClassLevel}`}
          </DialogTitle>
        </DialogHeader>

        {/* Step indicators */}
        {state.steps.length > 1 && (
          <div className="border-divider flex items-center gap-1 border-b px-6 pb-3">
            {state.steps.map((step, i) => (
              <div key={step.id} className="flex items-center gap-1">
                <div
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
                    i < state.currentStepIndex
                      ? 'bg-accent-emerald-bg text-accent-emerald-text'
                      : i === state.currentStepIndex
                        ? 'bg-accent-blue-bg text-accent-blue-text'
                        : 'bg-surface-secondary text-muted'
                  )}
                >
                  {i < state.currentStepIndex ? <Check size={12} /> : i + 1}
                </div>
                <span
                  className={cn(
                    'hidden text-xs sm:inline',
                    i === state.currentStepIndex
                      ? 'text-heading font-medium'
                      : 'text-muted'
                  )}
                >
                  {step.label}
                </span>
                {i < state.steps.length - 1 && (
                  <div className="bg-surface-secondary mx-1 h-px w-4" />
                )}
              </div>
            ))}
          </div>
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
            />
          )}

          {currentStep?.id === 'asi' && (
            <ASIFeatStep
              abilities={character.abilities}
              asiChoice={state.asiChoice}
              onChoiceChange={wizard.setASIChoice}
              allSpells={wizard.allSpells}
              spellsLoading={false}
            />
          )}

          {currentStep?.id === 'hp' && state.targetClass && (
            <HPStep
              hitDie={state.targetClass.hitDie}
              constitutionScore={character.abilities.constitution}
              hpRollResult={state.hpRollResult}
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
              selectedSubclass={state.selectedSubclass?.shortName}
              features={state.features}
              subclassFeatures={state.subclassFeatures}
              subclassSpellGrants={state.subclassSpellGrants}
              asiChoice={state.asiChoice}
              abilities={character.abilities}
              hpRollResult={state.hpRollResult}
              hitDie={state.targetClass.hitDie}
              conModifier={calculateModifier(character.abilities.constitution)}
              isCustomClass={state.isCustomClass}
              spellsKnownDelta={wizard.spellsKnownDelta}
              cantripsKnownDelta={wizard.cantripsKnownDelta}
            />
          )}
        </DialogBody>

        <DialogFooter>
          <div className="flex w-full items-center justify-between">
            <div>
              {!isFirstStep && (
                <Button variant="ghost" onClick={wizard.goBack}>
                  <ArrowLeft size={14} className="mr-1" />
                  Back
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              {isLastStep ? (
                <Button variant="primary" onClick={handleApply}>
                  <Check size={14} className="mr-1" />
                  Apply Level Up
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
