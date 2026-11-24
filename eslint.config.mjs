import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

import componentOrder from "./eslint-rules/component-order.mjs";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "node_modules/**",
    "coverage/**",
    "paraglide/**",
    ".claude/worktrees/**",
  ]),
  {
    plugins: { local: componentOrder },
    rules: {
      "import/order": [
        "error",
        {
          groups: ["builtin", "external", "internal", ["parent", "sibling", "index"]],
          pathGroups: [
            { pattern: "{react,react-dom,react-dom/**,next,next/**}", group: "builtin", position: "before" },
            { pattern: "@/**", group: "internal" },
          ],
          pathGroupsExcludedImportTypes: ["builtin"],
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { args: "after-used", argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-magic-numbers": [
        "error",
        {
          ignore: [-1, 0, 1, 2],
          ignoreArrayIndexes: true,
          ignoreDefaultValues: true,
          ignoreEnums: true,
          ignoreNumericLiteralTypes: true,
          ignoreReadonlyClassProperties: true,
          ignoreTypeIndexes: true,
        },
      ],
      "local/component-order": "error",
      // Arrow functions everywhere: `const name = (...) => {}` instead of `function name() {}`.
      // Class methods and generators (`function*`, which have no arrow form) are allowed.
      "func-style": ["error", "expression"],
      "prefer-arrow-callback": "error",
      "no-restricted-syntax": [
        "error",
        {
          selector: "FunctionExpression[generator=false]:not(MethodDefinition > FunctionExpression)",
          message: "Use an arrow function instead of a function expression.",
        },
      ],
      // Names must say what they hold: no single-letter identifiers except loop indexes and coordinates.
      "id-length": ["error", { min: 2, exceptions: ["i", "j", "k", "x", "y", "_"], properties: "never" }],
    },
  },
  {
    // Pixel-art drawing data: coordinates and sizes are the content itself.
    files: [
      "lib/office/sprites.ts",
      "lib/office/npcSprites.ts",
      "lib/office/bossSprites.ts",
      "lib/office/monsterSprites.ts",
      "lib/office/cryptSprites.ts",
      "lib/office/pixelFont.ts",
      "lib/office/render.ts",
      "lib/office/audio.ts",
      "lib/office/questBoardDraw.ts",
      "lib/office/dungeonScene.ts",
      "lib/office/dungeonAmbience.ts",
      "lib/office/gateAura.ts",
      "lib/office/dungeonLordSprite.ts",
      "lib/office/lordFx.ts",
      "lib/office/tierAura.ts",
      "lib/office/petSprites.ts",
      "lib/office/patronSprites.ts",
      "lib/office/hallRender.ts",
      "lib/office/hallLife.ts",
      "lib/office/bitmap.ts",
      "lib/office/voidBossSprite.ts",
      "lib/office/voidScene.ts",
      "lib/office/voidFx.ts",
      "tests/**",
    ],
    rules: { "@typescript-eslint/no-magic-numbers": "off" },
  },
  prettier,
]);

export default eslintConfig;
