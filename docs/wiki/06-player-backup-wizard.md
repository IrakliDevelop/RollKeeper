# Player Backup Wizard

A player-facing feature for backing up a character to the cloud (Supabase) and
restoring it later — with conflict resolution when the local and cloud copies
have diverged. This is distinct from:

- the automatic background character sync in
  [05](05-cloud-backend-supabase.md) (`automaticCharacterSync*` — a separate
  always-on engine), and
- the Redis live-session sync in [04](04-campaign-sync-redis.md) (ephemeral,
  session-only).

## Where it lives

`src/lib/playerBackup/`: `playerBackupCoordinator.ts` (entry point),
`playerBackupDashboard.ts`, `playerBackupEligibility.ts`,
`playerBackupFlags.ts` (feature-flag gate — check this before assuming the
wizard is enabled), `playerBackupManagement.ts`,
`playerBackupOngoingExecution.ts` / `playerBackupOnlineExecution.ts`,
`playerBackupRecoveryPolicy.ts`, `playerBackupRunFence.ts` /
`playerBackupRunRepository.ts`, `playerBackupSafety.ts`,
`playerBackupStatus.ts`, `playerBackupConflictCoordinator.ts` /
`playerBackupConflictResolution.ts`, `playerBackupActiveSelection.ts`,
`playerBackupCloudPreview.ts`, `playerBackupCopy.ts` (user-facing copy strings
— check here before hand-writing new UI text for this feature).

## UI surface

`src/components/ui/character/`: `PlayerBackupDashboardSurface.tsx`,
`PlayerBackupManager.tsx`, `PlayerBackupRecovery.tsx` (+ `.hooks.ts`),
`PlayerBackupSummaryCard.tsx`, and the `PlayerBackupWizard/` folder. Backed by
`useCharacterCloudBackup.ts` / `usePlayerBackupDashboard.ts`.

## Flow, at a high level

1. **Eligibility** check (`playerBackupEligibility.ts`) — not every
   character/account state is backup-eligible.
2. **Backup** (online or "ongoing" background execution) writes the character
   snapshot to Supabase via the `characterCloud*` codec/gateway
   ([05](05-cloud-backend-supabase.md)).
3. **Restore** re-hydrates from the cloud copy, going through
   `playerBackupRecoveryPolicy.ts`.
4. **Conflict resolution**: if local and cloud have diverged since the last
   backup, `playerBackupConflictCoordinator`/`ConflictResolution` surfaces a
   choice to the user rather than silently picking a side.

## e2e coverage

`npm run test:indexeddb:e2e` runs both the IndexedDB migration suite and the
player-backup-recovery Playwright config
(`playwright.player-backup-recovery.config.ts`) together — the two are
tested jointly because backup/restore interacts directly with the
localStorage→IndexedDB cutover state ([03](03-persistence-and-storage-migration.md)).
Also: `npm run test:db:backup-restore` (Node integration test against a real
local Supabase instance).

## Known-issue notes (unmerged, as of 2026-09)

At the time this wiki was written, several untracked investigation docs exist
at the repo root/`docs/` describing specific bugs under active investigation
(fresh-browser recovery, post-restore false-conflict, rollback stale-status).
These are the maintainer's in-progress working notes, not committed project
documentation — don't treat them as a canonical bug list; check `git log` and
open PRs/issues for current status instead.
