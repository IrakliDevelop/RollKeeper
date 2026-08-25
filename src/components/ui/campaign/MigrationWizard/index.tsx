'use client';

import { useEffect } from 'react';
import { CircleDashed, CircleDot } from 'lucide-react';

import { Button } from '@/components/ui/forms/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/feedback/dialog';
import { DURABLE_FAMILY_REGISTRY } from '@/lib/durableDm/familyRegistry';

import { useMigrationWizard } from './MigrationWizard.hooks';
import { FamilyStep } from './steps/FamilyStep';
import { RecoveryStep } from './steps/RecoveryStep';
import { ReportStep } from './steps/ReportStep';
import { WorkspaceStep } from './steps/WorkspaceStep';

export interface MigrationWizardProps {
  campaignCode: string;
  /**
   * Task 17 (dedicated route) wires this to `router.replace('/dm/campaign/<code>')`
   * so fresh durable-family owners mount before editable campaign UI returns
   * (spec R2a). Optional and a no-op by default so this component stays
   * testable standalone.
   */
  onClose?: () => void;
}

/**
 * Task 14 built the shell plus steps 0 and 1. Task 15 adds steps 2..N — one
 * per registered data category (spec R6, R12, R13) — as `stepIndex` moves
 * from -1 (the intro: steps 0/1, stacked exactly as Task 14 left them)
 * through 0..`DURABLE_FAMILY_REGISTRY.length - 1` (one registry entry each,
 * registered or planned, in fixed order). Rail rows are not clickable
 * (settled decision) — navigation is exclusively Back / Continue / Skip.
 * Dedicated route (`/dm/migrate/[code]`, spec R2a) is Task 17; this
 * component only owns the dialog contents.
 */
export function MigrationWizard({
  campaignCode,
  onClose,
}: MigrationWizardProps) {
  const controller = useMigrationWizard(campaignCode);

  // Task 16: `stepIndex === DURABLE_FAMILY_REGISTRY.length` is one past the
  // last registry entry (registered or planned) -- the final report (spec
  // R6 does not name a step for it; it is reached the same way every other
  // step is, via Continue, and it is the terminal step: `goContinue` caps
  // at this index).
  const isReportStep = controller.stepIndex === DURABLE_FAMILY_REGISTRY.length;
  const currentEntry =
    controller.stepIndex >= 0 && !isReportStep
      ? DURABLE_FAMILY_REGISTRY[controller.stepIndex]
      : null;
  const currentAdapter =
    currentEntry?.status === 'registered'
      ? controller.adapterFor(currentEntry.family)
      : null;
  const currentEnabled =
    currentEntry?.status === 'registered'
      ? (currentAdapter?.isVisible() ?? false)
      : false;
  const currentContext =
    currentEntry?.status === 'registered'
      ? controller.contextFor(currentEntry.family)
      : null;
  const currentAuthority =
    currentEntry?.status === 'registered'
      ? (controller.familyAuthorities[currentEntry.family] ?? null)
      : null;

  // Refresh the current family's authority whenever the DM navigates onto
  // it, so a resumed/reloaded run reads its real state instead of the
  // "never visited" default. `refreshFamilyAuthority` itself is a no-op
  // until workspace discovery has resolved (spec R6: derived, never stored).
  useEffect(() => {
    if (currentEntry?.status !== 'registered') return;
    void controller.refreshFamilyAuthority(currentEntry.family);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on step identity; refreshFamilyAuthority is stable per its own deps
  }, [controller.stepIndex]);

  // Spec R14: verification runs when the DM ENTERS the report -- keyed on
  // `isReportStep` flipping false -> true, never on every render while
  // already there, and never merely because some OTHER piece of state
  // changed. Leaving the report and coming back (Back, then Continue again)
  // flips this same boolean false then true again, which is what makes
  // re-entering the report re-verify (spec: "reopening the report verifies
  // again").
  useEffect(() => {
    if (!isReportStep) return;
    void controller.verifyReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on entering the report step, not on verifyReport's own identity
  }, [isReportStep]);

  if (!controller.visible) return null;

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent size="lg" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Move campaign data to cloud sync</DialogTitle>
          <DialogDescription>
            One data category at a time, with a backup of this browser first.
            Nothing moves until you confirm it, and you can stop after any
            category.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="flex gap-5">
          <aside className="border-divider bg-surface-secondary hidden w-[252px] shrink-0 flex-col gap-1 rounded-lg border p-3 sm:flex">
            <p className="text-muted mb-1.5 px-1.5 text-[11px] font-bold tracking-wide uppercase">
              This run
            </p>
            <p className="text-muted mb-1.5 px-1.5 text-xs">
              {controller.routedCount} of {controller.registeredCount} data
              categories moved to cloud sync
            </p>
            <RailRow
              label="Your account"
              done={controller.workspace !== null}
            />
            <RailRow
              label="Browser backup"
              done={
                controller.recovery.status === 'verified' ||
                controller.recovery.status === 'resumed'
              }
            />
            {DURABLE_FAMILY_REGISTRY.filter(
              entry => entry.status === 'registered'
            ).map(entry => (
              <RailRow
                key={entry.family}
                label={entry.label}
                done={
                  entry.status === 'registered' &&
                  controller.familyAuthorities[entry.family]?.state ===
                    'postgres'
                }
              />
            ))}
            <div className="border-divider mt-2 border-t pt-2">
              <p className="text-faint mb-1 px-1.5 text-[11px]">
                Not yet available
              </p>
              {DURABLE_FAMILY_REGISTRY.filter(
                entry => entry.status === 'planned'
              ).map(entry => (
                <div
                  key={entry.family}
                  className="flex items-center gap-2 px-1.5 py-1"
                >
                  <span className="border-divider size-2 shrink-0 rounded-full border" />
                  <span className="text-faint text-sm">{entry.label}</span>
                </div>
              ))}
            </div>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col gap-6">
            {controller.stepIndex === -1 && (
              <>
                <WorkspaceStep
                  campaignCode={campaignCode}
                  discovering={controller.discovering}
                  discoveryError={controller.discoveryError}
                  signedIn={controller.accountId !== null}
                  workspace={controller.workspace}
                  onDiscover={() => void controller.discover()}
                />
                <RecoveryStep
                  recovery={controller.recovery}
                  onDownload={() => void controller.downloadBundle()}
                  onSelectFile={file => void controller.selectBundleFile(file)}
                  onEnrich={() => void controller.enrichLegacyReceipt()}
                />
              </>
            )}
            {currentEntry && (
              <FamilyStep
                entry={currentEntry}
                stepNumber={controller.stepIndex + 3}
                totalSteps={DURABLE_FAMILY_REGISTRY.length + 3}
                enabled={currentEnabled}
                adapter={currentAdapter}
                context={currentContext}
                authority={currentAuthority}
                runRecovery={{
                  runId: controller.runId,
                  manifestHash: controller.recovery.manifestHash ?? '',
                }}
                onCheckDrift={controller.checkFamilyDrift}
                onRun={() =>
                  currentEntry.status === 'registered'
                    ? controller.runFamily(currentEntry.family)
                    : Promise.resolve({
                        outcome: 'error' as const,
                        message: 'This data category is not available yet.',
                      })
                }
                onRepair={() =>
                  currentEntry.status === 'registered'
                    ? controller.repairFamily(currentEntry.family)
                    : Promise.resolve({
                        ok: false,
                        message: 'This data category is not available yet.',
                      })
                }
                onSkip={controller.goContinue}
              />
            )}
            {isReportStep && (
              <ReportStep
                stepNumber={DURABLE_FAMILY_REGISTRY.length + 3}
                totalSteps={DURABLE_FAMILY_REGISTRY.length + 3}
                familyAuthorities={controller.familyAuthorities}
                verifications={controller.reportVerifications}
                verifying={controller.reportVerifying}
                crossFamilyDrift={controller.reportCrossFamilyDrift}
                adapterFor={controller.adapterFor}
                onRefresh={() => void controller.verifyReport()}
              />
            )}
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onClose?.()}>
            Close
          </Button>
          <Button
            variant="outline"
            onClick={controller.goBack}
            disabled={controller.stepIndex === -1}
          >
            Back
          </Button>
          <Button
            variant="primary"
            onClick={controller.goContinue}
            disabled={!controller.canContinue || isReportStep}
          >
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RailRow({ label, done }: { label: string; done: boolean }) {
  const Icon = done ? CircleDot : CircleDashed;
  return (
    <div className="flex items-center gap-2 rounded-md px-1.5 py-1">
      <Icon
        size={8}
        className={done ? 'text-accent-emerald-text' : 'text-faint'}
        aria-hidden="true"
      />
      <span className="text-body truncate text-[13px]">{label}</span>
    </div>
  );
}
