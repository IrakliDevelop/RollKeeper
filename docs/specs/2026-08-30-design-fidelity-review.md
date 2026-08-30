# Design-fidelity review — player backup wizard

Prep for the design-fidelity review required before the final browser gate,
per `docs/specs/2026-08-26-player-backup-wizard-plan.md` lines 1513-1530
(quoted below). **This document is prep only — no visual comparison has been
performed.** It sets up how to run the review, enumerates every scenario that
must be checked, and provides an empty findings table for the reviewer to
fill in.

> Before the final browser gate, open the player prototype files from the
> design archive and compare them against deterministic production component
> fixtures. Cover all 19 wizard prototype scenarios and all six dashboard
> scenarios. At a minimum, capture desktop comparisons for every scenario and
> 390 px comparisons for account, safety-file pending and mismatch,
> selection, partial result, conflict, management, recovery, dashboard
> not-started, and dashboard ongoing.
>
> The review checks hierarchy, spacing, widths, typography, icon sizing,
> badges, status tones, action grouping, selected and disabled rows, and the
> compact completed state. Repeat representative fixtures in dark and
> parchment themes to verify the semantic-token adaptation. The prototype's
> design-state strip, hard-coded colors, file metrics, and synthetic data are
> excluded by design. Record every other intentional difference with its
> safety, accessibility, or responsive reason. Do not call the design matched
> based only on component tests or on the archive thumbnail.

## 1. How to run

The prototype archive is `docs/specs/Rollkeeper Cloud Migration Wizard.zip`
(untracked in git, kept locally). **Do not extract it into the repository
working tree.** Extract to a temp directory outside the repo, e.g.:

```bash
mkdir -p /tmp/design-fidelity-review
unzip "docs/specs/Rollkeeper Cloud Migration Wizard.zip" -d /tmp/design-fidelity-review
```

- **Wizard prototype**: open `/tmp/design-fidelity-review/Player Backup Wizard.html`
  directly in a browser. It is a fully standalone 202 KB export (fonts and
  script inlined) — no companion files needed. It renders with a "Design
  states" strip across the top; click a scenario's pill to switch the
  artboard to that state. That strip itself is excluded from comparison (see
  section 4) — it is only the navigation mechanism.
- **Dashboard prototype**: `Player Dashboard.dc.html` is *not* standalone —
  it loads `./support.js` and font files by relative path, so open it from
  the extracted directory (which keeps those siblings alongside it) rather
  than moving the single file elsewhere. It exposes the same kind of
  scenario picker as the wizard file.
- **`.thumbnail`** (the 14 KB file at the archive root) is a static preview
  image, not a live artboard. It is **inadmissible** as review evidence —
  never use it in place of opening the actual HTML.
- **Production fixtures**: run `npm run storybook` and open:
  - `PlayerBackupWizard` stories (`src/components/ui/character/PlayerBackupWizard/PlayerBackupWizard.stories.tsx`)
  - `PlayerBackupSummaryCard` stories (`src/components/ui/character/PlayerBackupSummaryCard.stories.tsx`)
- Compare prototype and Storybook side by side (split-screen or two
  monitors), scenario by scenario, using the mapping in section 2.
- For 390 px checks: the dashboard stories have dedicated narrow story
  exports using Storybook's built-in `mobile1` viewport, which defaults to
  **375 px**, not 390 px — use the viewport toolbar's custom-size input to
  set exactly 390 px rather than relying on `mobile1` alone. The wizard
  stories have **no dedicated narrow exports at all**; for every wizard
  scenario that needs a 390 px check, open its normal (desktop) story and
  resize via the same toolbar's custom width to 390 px.
- Component tests, Storybook snapshots, and the archive thumbnail are
  supplemental evidence only — none of them substitute for actually opening
  both the prototype HTML and the live Storybook story side by side, per the
  plan's explicit instruction not to call the design matched on component
  tests or the thumbnail alone.

## 2. Scenario matrix

### Wizard (19 of 19 have deterministic production fixtures)

The prototype's internal `SCENARIOS` list (in `Player Backup Wizard.html`)
and the production fixture list (`PLAYER_BACKUP_WIZARD_SCENARIOS` in
`PlayerBackupWizard.fixtures.ts`) are the same 19 states in the same order —
every wizard scenario has a deterministic Storybook story. None need live
wizard driving.

| # | Scenario | Prototype location (design-state strip label / internal id) | Production fixture (story) | Desktop required | 390px required | Themes required |
|---|---|---|---|---|---|---|
| 1 | Signed out | "Signed out" (`signedOut`) | `SignedOut` | required | — | — |
| 2 | Account ready | "Account ready" (`signedIn`) | `AccountReady` | required | required* (see note) | — |
| 3 | Account check failed | "Account check failed" (`accountError`) | `AccountCheckFailed` | required | — | — |
| 4 | Safety file needed (pending) | "Safety file needed" (`file`) | `SafetyFileNeeded` | required | required | — |
| 5 | Safety file checked | "Safety file checked" (`fileVerified`) | `SafetyFileChecked` | required | — | — |
| 6 | Wrong file (mismatch) | "Wrong file" (`fileMismatch`) | `WrongFile` | required | required | — |
| 7 | File still matches | "File still matches" (`fileResume`) | `FileStillMatches` | required | — | — |
| 8 | Choose characters (selection) | "Choose characters" (`select`) | `ChooseCharacters` | required | required | required (`ChooseCharactersDark`, `ChooseCharactersParchment`) |
| 9 | One copy only | "One copy only" (`selectOnce`) | `OneCopyOnly` | required | — | — |
| 10 | Account changed | "Account changed" (`selectChanged`) | `AccountChanged` | required | — | — |
| 11 | Backing up | "Backing up" (`running`) | `BackingUp` | required | — | — |
| 12 | Result — protected | "Result — protected" (`complete`) | `ResultProtected` | required | — | required (`ResultProtectedDark`, `ResultProtectedParchment`) |
| 13 | Result — copies saved | "Result — copies saved" (`completeOnce`) | `ResultCopiesSaved` | required | — | — |
| 14 | Result — needs attention (partial) | "Result — needs attention" (`partial`) | `ResultNeedsAttention` | required | required | — |
| 15 | Result — offline | "Result — offline" (`offline`) | `ResultOffline` | required | — | — |
| 16 | Conflict choice | "Conflict choice" (`conflict`) | `ConflictChoice` | required | required | — |
| 17 | Needs newer version | "Needs newer version" (`future`) | `NeedsNewerVersion` | required | — | — |
| 18 | Manage backups (management) | "Manage backups" (`manage`) | `ManageBackups` | required | required | — |
| 19 | Recovery required | "Recovery required" (`recovery`) | `RecoveryRequired` | required | required | — |

\* The plan names "account" as one of the 10 named 390 px scenarios without
specifying which of the three account-step states (signed out / ready /
check failed). This review treats **Account ready** (`AccountReady`) as the
representative 390 px check, since it is the step's resting state, the same
convention used for "selection" → `ChooseCharacters` rather than its
`OneCopyOnly`/`AccountChanged` variants. If the reviewer judges signed-out or
account-check-failed layouts diverge meaningfully at 390 px, check those too
and record it as an addition, not a substitution.

### Dashboard (6 of 6 have deterministic production fixtures)

The prototype's `SCENARIOS` list in `Player Dashboard.dc.html` and
`PLAYER_BACKUP_DASHBOARD_SCENARIOS` in `PlayerBackupSummaryCard.fixtures.ts`
are the same 6 states in the same order.

| # | Scenario | Prototype location (design-state strip label / internal id) | Production fixture (story) | Desktop required | 390px required | Themes required |
|---|---|---|---|---|---|---|
| 1 | Not started | "Not started" (`notStarted`) | `NotStarted` (390px: `NotStartedNarrow`) | required | required | — |
| 2 | Resumable (not finished) | "Not finished" (`resumable`) | `Resumable` | required | — | — |
| 3 | Ongoing complete (backup is on) | "Backup is on" (`ongoing`) | `OngoingComplete` (390px: `OngoingNarrow`) | required | required | required (`OngoingDark`, `OngoingParchment`) |
| 4 | One-time complete (copies saved) | "Copies saved" (`onceDone`) | `OneTimeComplete` | required | — | — |
| 5 | No characters | "No characters" (`noChars`) | `NoCharacters` | required | — | — |
| 6 | Unavailable | "Unavailable" (`unavailable`) | `Unavailable` (390px: `UnavailableNarrow`, bonus — not required by the plan) | required | — | — |

### Coverage summary

- 19/19 wizard scenarios have a deterministic fixture — 0 need live wizard
  driving.
- 6/6 dashboard scenarios have a deterministic fixture — 0 need live
  driving.
- 25/25 total prototype scenarios named by the plan are covered by
  Storybook stories today. No scenario requires the reviewer to hand-drive
  the app to reach a state; every comparison is prototype-HTML-vs-Storybook.
- Of the 10 named 390 px-required scenarios, only 2 dashboard ones
  (`NotStartedNarrow`, `OngoingNarrow`) have a dedicated narrow story export.
  The other 8 (7 wizard scenarios plus the ambiguous "account" pick) require
  the reviewer to manually set the Storybook viewport toolbar to 390 px on
  the existing desktop story — see section 1.

## 3. Comparison dimensions

Per the plan, the review checks:

1. Hierarchy
2. Spacing
3. Widths
4. Typography
5. Icon sizing
6. Badges
7. Status tones
8. Action grouping
9. Selected and disabled rows
10. Compact completed state

## 4. Excluded by design

The following are explicitly excluded from comparison — do not record
differences in these as findings:

- The prototype's design-state strip (the scenario-picker pill row at the
  top of the prototype HTML) — navigation chrome, not part of the design.
- Hard-coded colors in the prototype (it uses literal hex values throughout;
  production uses semantic CSS tokens — token *adaptation* across themes is
  what section 3's dark/parchment repeats verify, not color-for-color
  matching against the prototype's hex values).
- File metrics (the prototype's synthetic file sizes/counts).
- Synthetic data (prototype character names/emails — `Sister Aveline`,
  `Thalia Reed`, `Sir Roderick`, `player@example.com`/`lyra@example.com` —
  are fixture data, not meaningful content to compare).

## 5. Findings

*(Empty — to be filled in during the actual review.)*

| Scenario | Difference | Intentional? | Safety / accessibility / responsive reason |
|---|---|---|---|
| | | | |

## 6. Sign-off

| Field | Value |
|---|---|
| Reviewer | *(pending)* |
| Date | *(pending)* |
| Verdict | *(pending — "matched with recorded intentional differences" or "divergences require fixes")* |
