import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Honour the `_`-prefix convention for intentionally-unused bindings
  // (e.g. `metrics: _metrics` props kept for a stable component signature).
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".tmp/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Claude Code local worktrees are full tree copies, not part of the app.
    ".claude/**",
  ]),
]);

export default eslintConfig;
