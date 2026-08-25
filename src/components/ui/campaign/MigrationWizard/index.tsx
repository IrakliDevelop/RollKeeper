'use client';

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
import { RecoveryStep } from './steps/RecoveryStep';
import { WorkspaceStep } from './steps/WorkspaceStep';

export interface MigrationWizardProps {
  campaignCode: string;
}

/**
 * Task 14: the wizard shell plus steps 0 and 1. Both steps render stacked on
 * one page rather than gated behind a real step machine — there is no step 2
 * (a family) built yet to advance to, so the footer's Continue control stays
 * unconditionally disabled here (Task 15 enables it once a family step
 * exists). Dedicated route (`/dm/migrate/[code]`, spec R2a) is Task 17; this
 * component only owns the dialog contents.
 */
export function MigrationWizard({ campaignCode }: MigrationWizardProps) {
  const controller = useMigrationWizard(campaignCode);

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
              <RailRow key={entry.family} label={entry.label} done={false} />
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
            <WorkspaceStep
              campaignCode={campaignCode}
              discovering={controller.discovering}
              discoveryError={controller.discoveryError}
              workspace={controller.workspace}
              onDiscover={() => void controller.discover()}
            />
            <RecoveryStep
              recovery={controller.recovery}
              onDownload={() => void controller.downloadBundle()}
              onSelectFile={file => void controller.selectBundleFile(file)}
              onEnrich={() => void controller.enrichLegacyReceipt()}
            />
          </div>
        </DialogBody>

        <DialogFooter>
          {/* Always disabled in this task: there is no step 2 (a family)
              built yet to advance to. Task 15 wires this up. */}
          <Button variant="primary" disabled>
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
