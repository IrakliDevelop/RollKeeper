# Feature Flags & Gated Work

Several major subsystems in this repo are mid-rollout, controlled by explicit
flag files rather than being fully on or off. **A feature existing in code, or
reading as "done" in a commit message, does not mean it's active for all
users.** Before describing current behavior (to a user, in a PR, or in your
own reasoning about what a change will do), check the relevant flag.

## Where the flags live

- `src/lib/durableDm/slice11aFlags.ts` … `slice11gFlags.ts` (and equivalents
  for earlier slices 8/9/10) — gate the per-domain Redis→Supabase
  authoritative-storage migration, one domain/slice at a time. See
  [05](05-cloud-backend-supabase.md).
- `src/lib/playerBackup/playerBackupFlags.ts` — gates the backup/restore
  wizard. See [06](06-player-backup-wizard.md).
- Fog-of-war preset **campaign persistence** was merged explicitly "(gate
  off)" per its commit message — confirm current state before assuming it's
  live. See [07](07-battlemap-fog-fieldnotes.md).
- `src/components/ui/layout/ExperimentalFeaturesSection.tsx` — a user-facing
  toggle surface for experimental features; if a feature has a flag, this may
  be where a user can opt in/out.

## Why this matters for an agent

- Don't write a PR description or user-facing explanation asserting a gated
  feature is "live" without checking its flag's default value.
- Don't remove a flag as "dead code cleanup" without confirming the rollout
  is actually complete — a flag file with all domains still gated is a sign
  of active, in-progress migration work, not leftover cruft.
- When adding a new domain to an existing migration family (durableDm,
  player backup), follow the existing flag pattern rather than hardcoding a
  new on/off switch — consistency matters here because multiple slices are
  being coordinated together.
- If unsure whether something is shipped, grep for the flag/constant by name
  rather than trusting a summary, a commit message, or this wiki — this
  changes weekly (there was an open PR touching fog material previews the
  same day this wiki was written).
