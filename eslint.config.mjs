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
  globalIgnores([
    "storybook-static/**",
    "claude_design/**",
  ]),
];

export default eslintConfig;
