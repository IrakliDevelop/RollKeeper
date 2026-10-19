---
name: rollkeeper-copy
description: Use when writing, editing or reviewing any user-visible text in RollKeeper (headings, buttons, labels, empty states, toasts, errors, confirmations, placeholders, aria-labels, tooltips, landing copy), and before opening a PR that adds or changes such text. Catches generic LLM-sounding copy ("X, not Y" slogans, "everything you need", "seamlessly", hype, fantasy filler) and rewrites it in RollKeeper's plain table-side voice.
argument-hint: "[--base <branch>] or a file/string to review"
---

# RollKeeper copy

RollKeeper sits next to a character sheet and a pile of dice. Its text should
read like a careful player wrote it for the person across the table: short,
specific, in the game's own words. It describes what is on the screen and
what the player can do there. It doesn't advertise the app, and each line
should only make sense in RollKeeper.

## The four questions

Ask these of every string. One "no" means rewrite.

1. **Is it specific to this screen?** It names the real thing here: a spell
   slot, Goblin 2, the long rest. Vague nouns such as "content", "tools",
   "features" or "your experience" fail.
2. **Would a player say it out loud at the table?** "Take a long rest" yes.
   "Unlock seamless session management" no.
3. **Does the reader lose information if it is deleted?** If not, delete it.
4. **Could only RollKeeper say it?** A heading or sentence should mention
   something particular to this screen or this game. Plain action labels
   such as Cancel or Close are exempt.

Judge a string by what it names. A tight five-word slogan can still fail all
four questions.

## LLM tells to remove

These patterns make copy read as machine-written. Rewrite each one from
scratch: swapping a word or two leaves the pattern in place.

| Tell | Looks like | Do instead |
|---|---|---|
| Contrast slogan | "Keep the game moving, not the paperwork"; "Less X, more Y"; "Not just X, it's Y"; "It's not about X, it's about Y" | State what the thing does: "Character sheets, initiative and maps for your table". The "not Y" half carries no information and the "X" half names no feature |
| Everything-promise | "Everything you need", "all in one place", "right at your fingertips", "comprehensive" | Name the two or three real things |
| Puffery | seamless(ly), effortless(ly), powerful, robust, intuitive, elevate, enhance, unleash, unlock, empower, streamline, supercharge, next-level, game-changing | Delete the word, or replace it with the concrete effect |
| Fantasy filler | "from across the multiverse", "brave adventurer", "your legend begins", "adventure awaits" | Plain words. Keep flavour for game content such as spell and monster text |
| Rhetorical question as heading | "Ready to roll?", "Need a hand?" | A heading that names the section, or a verb-first action |
| Rhythm triplets | "Track, roll and conquer"; three adjectives in a row | Keep only items that are real and different; two is fine |
| Hype punctuation | "!", "…" for drama, emoji, "✨" | Full stop or nothing. Ellipsis only for work in progress ("Saving…") |
| Success theatre | "successfully", "Awesome!", "You're all set!" | Past-tense fact: "Character saved" |
| Apology and hedging | "Oops!", "Sorry", "Something went wrong", "It seems", "may have" | Say what happened and what to do |
| Self-reference | "our powerful app", "we've got you covered", "RollKeeper helps you…" | Talk about the user's character, campaign or table |
| Filler openers | "Welcome to", "Get started by", "Simply", "Just", "Easily" | Start with the action or the noun |
| Title Case and shouting | "Create New Character", "NO CHARACTERS YET", tracked uppercase labels | Sentence case: "Create character" |

## Patterns by element

- **Buttons:** verb first, names the outcome, short, usually two to four
  words: "Create character", "Take a long rest", "Add to initiative". Never
  "Submit", "OK", "Click here".
- **Toasts and confirmations:** mirror the button's verb in the past tense:
  "Take a long rest" then "Long rest taken". No "successfully".
- **Errors:** what happened, then what to do, in one or two short sentences:
  "Couldn't reach the campaign. Your changes are saved on this device and will
  sync when you're back online." No "Error:", no apology, no exception text.
- **Empty states:** an invitation with the action: heading "Create your first
  character", button "Create character". Not "No Characters Yet".
- **Destructive confirmations:** name the thing and the consequence: "Delete
  Thalia Vane? The sheet is removed from this device." Button: "Delete
  character".
- **Labels and headings:** nouns in sentence case: "Hit points", "Spell
  slots", "Saving throws". Abbreviations AC, HP, CR, DC and XP stay as plain
  capitals, never letter-spaced.
- **Placeholders:** a real example of valid input ("Thalia Vane", "2d6 + 3"),
  never a repeat of the label and never "e.g.".
- **aria-labels and icon buttons:** action plus target: "Remove Goblin 2 from
  initiative", "Close spell details". Not "Button", not "Icon".
- **Numbers:** digits, with units where they matter: "30 ft", "+5 temp HP",
  "3 of 4 slots".

## Game vocabulary

- **5e terms:** use the words players already know, spelled the way the
  books spell them: hit points, temporary hit points, armor class, saving
  throw, ability check, spell slot, cantrip, concentration, short rest, long
  rest, initiative, condition, exhaustion, death saves, Dungeon Master (DM),
  non-player character (NPC).
- **No invented words:** don't invent cute synonyms ("health juice", "magic
  charges") and don't use video-game words for tabletop things ("respawn",
  "loot drop", "XP bar"). "Level up" is fine because it is the game's own
  term.
- **Dice and rolls:** RollKeeper players roll physical dice at the table and
  in-app rolling is off, so don't write copy that promises rolling ("Roll for
  damage") unless the feature is on.

## Reviewing a branch (the pre-PR copy gate)

Run this before opening any PR that adds or changes user-visible text. It is
a review: report findings, don't silently rewrite.

1. List the strings the branch adds or changes:

   ```bash
   npm run copy:changed -- --base <the PR's base branch>
   ```

   It prints `file:line`, the kind and the text (`--json` gives the same as
   data). `{…}` marks an interpolated value. The kinds are:

   - `jsx-text`: text and string expressions between JSX tags;
   - `prop`: `title`, `aria-label`, `placeholder` and any prop ending in
     `Label`, `Text`, `Title`, `Description`, `Message`, `Hint`,
     `Placeholder` or `Heading`, plus default values of such props and
     parameters (`{ title = '…' }`);
   - `message`: arguments to toast, alert, confirm, `addToast` and setter
     calls such as `setError`, `setMessage`, `setStatus`, `setTitle`,
     `setLabel`, `setText`, `setDescription` and `setHint`;
   - `object`: values of copy-named object keys anywhere (`label`, `title`,
     `description`, `message`, `text`, `body`, `content`, `caption`,
     `aria-label`, any `*Label` or `*Text`, …);
   - `const`: SCREAMING_SNAKE constants, and variables named `message`,
     `title`, `label`, `text`, `hint`, … or ending in one (`errorMessage`,
     `emptyTitle`);
   - `other`: the catch-all. Any other string of two or more words, unless it
     is a class list, CSS, a module path, a type, a property key, a
     `console` or `new Error` message, or sits inside `className`, `key`,
     `href`, `data-*` or an event handler.

   It includes multi-line strings when any of their lines changed, and
   untracked files. It is deliberately broad, so expect noise rows (file
   paths, CSS variable names, game-rules descriptions) and skip them.
2. Read the added lines of the diff too. This step is required, even when
   step 1 lists nothing:

   ```bash
   git diff --unified=0 <base> -- src
   git ls-files --others --exclude-standard -- src   # untracked: read them whole
   ```

   The extractor misses strings built by concatenation or helper functions,
   values computed at runtime, messages passed to `new Error` that the UI
   later shows, text outside `src/**/*.ts(x)`, and test and story files.
   Judge any user-visible prose you find there as well.
3. Read each string in its component, so you know where it appears and what
   the user is doing at that moment.
4. Judge it with the four questions, the tells table and the element
   patterns. Game rules text copied from the SRD or the user's own content
   (spell descriptions, monster traits, notes) is not UI copy: skip it.
5. Report one row per string that needs work, and a count of the strings
   that passed:

   | Location | Current | Problem | Proposed |
   |---|---|---|---|
   | `src/app/page.tsx:364` | Keep the game moving, not the paperwork | Contrast slogan; says nothing about the product | Character sheets, initiative and maps for your table |

6. Verdict: **pass** (nothing to change), or **changes needed** with the
   table. The author applies the rewrites, greps tests for each old string
   (`rg -F "<old string>" src e2e`) and updates them in the same commit.

Scope rules for the gate:

- Strings this branch introduces: fix them before the PR.
- Existing strings the branch only moved or reformatted: leave them.
- Rewording an existing string is a visible change: list it separately in
  the PR for the owner's approval, as with any other visible change.
