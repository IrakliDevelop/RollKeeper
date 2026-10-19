import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import storybook from "eslint-plugin-storybook";
import { globalIgnores } from "eslint/config";

const eslintConfig = [
  ...nextVitals,
  ...nextTypescript,
  ...storybook.configs["flat/recommended"],
  {
    // Keep the Next 15 lint baseline. React Hooks 7 adds compiler-oriented
    // rules that are useful for an opt-in migration but unrelated to linting
    // this existing application during the security upgrade.
    rules: {
      "react-hooks/config": "off",
      "react-hooks/error-boundaries": "off",
      "react-hooks/gating": "off",
      "react-hooks/globals": "off",
      "react-hooks/immutability": "off",
      "react-hooks/incompatible-library": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/purity": "off",
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/set-state-in-render": "off",
      "react-hooks/static-components": "off",
      "react-hooks/unsupported-syntax": "off",
      "react-hooks/use-memo": "off",
      "react-hooks/void-use-memo": "off",
    },
  },
  {
    // Native confirm/alert/prompt are replaced by the shared in-app dialog
    // (confirmDialog, alertDialog, promptDialog in
    // src/components/ui/feedback/confirm-dialog).
    files: ["src/**/*.{ts,tsx}"],
    ignores: [
      // Cloud-sync cards still use window.confirm until Felt and Brass 1c1b
      // part (b) moves them to confirmDialog.
      "src/components/ui/campaign/CombatLogArchiveSyncControls/CombatLogArchiveSyncControls.hooks.ts",
      "src/components/ui/campaign/NpcSyncControls/NpcSyncControls.hooks.ts",
      "src/components/ui/campaign/EncounterSyncControls/EncounterSyncControls.hooks.ts",
      "src/components/ui/campaign/MagicItemLibrary/MagicItemSyncControls.tsx",
      "src/components/ui/campaign/CampaignSettingsSyncControls.tsx",
      "src/components/ui/calendar/CalendarSyncControls.tsx",
    ],
    rules: {
      "no-alert": "error",
    },
  },
  globalIgnores([
    "storybook-static/**",
    "claude_design/**",
  ]),
];

export default eslintConfig;
