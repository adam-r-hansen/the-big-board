// eslint.config.mjs
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import nextPlugin from "@next/eslint-plugin-next";

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
  // Base JS + Next + TS
  js.configs.recommended,
  ...tseslint.configs.recommended,
  nextPlugin.configs["core-web-vitals"],

  // Global tweaks: turn a few noisy rules into warnings instead of errors
  {
    rules: {
      // Next perf hint; keep as warn so it doesn't block builds
      "@next/next/no-img-element": "warn",
      // This stylistic rule often flags copy that includes quotes
      "react/no-unescaped-entities": "off",
    },
  },

  // API routes & script-y code – allow `any` during rapid iteration
  {
    files: [
      "app/api/**/*.{ts,tsx}",
      "lib/espn.ts",
      "app/page.tsx",
      "app/picks/page.tsx",
      "app/scoreboard/page.tsx",
      "app/standings/page.tsx",
      "components/TeamPill.tsx",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
    },
  },
];

