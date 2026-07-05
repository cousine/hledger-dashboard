import tsparser from "@typescript-eslint/parser";
import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";

export default defineConfig([
  {
    ignores: ["main.js", "node_modules/"],
  },
  ...obsidianmd.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: { project: "./tsconfig.json" },
    },
    rules: {
      "obsidianmd/ui/sentence-case": [
        "warn",
        {
          acronyms: ["USD", "EUR", "GBP", "PATH"],
          allowAutoFix: true,
        },
      ],
      "obsidianmd/settings-tab/prefer-setting-definitions": "off",
    },
  },
]);
