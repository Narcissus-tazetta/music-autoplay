import dprint from "@ben_12/eslint-plugin-dprint";
import eslint from "@eslint/js";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

// eslint-disable-next-line @typescript-eslint/no-deprecated
export default tseslint.config(
  eslint.configs.recommended,
  // Ensure eslint-plugin-react can auto-detect React version across the repo.
  // Some invocations of ESLint may run against files not covered by the
  // per-files config below; placing a top-level setting makes the intent
  // explicit and avoids the runtime warning.
  {
    settings: {
      react: { version: "detect" },
    },
  },
  tseslint.configs.strictTypeChecked.map((cfg) => ({
    ...cfg,
    files: ["**/*.{ts,tsx}"],
  })),
  react.configs.flat.recommended,
  react.configs.flat["jsx-runtime"],
  reactHooks.configs["recommended-latest"],
  reactRefresh.configs.vite,
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  {
    // @ts-expect-error eslint-dprint-pluginの型情報の不足によるエラーを回避
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    ...dprint.configs["disable-typescript-conflict-rules"],
    plugins: { dprint },
  },
  {
    ignores: [
      "build/**/*",
      "dist/**/*",
      "node_modules/**/*",
      ".react-router/**/*",
      "**/*.d.ts",
      // ignore generated or third-party shadcn UI components
      "src/app/components/ui/shadcn/**",
      // temporarily ignore extension code while server hardening proceeds
      "src/extension/**",
    ],
  },
  // Node scripts override
  {
    files: ["scripts/**/*.js", "scripts/**/*.ts"],
    languageOptions: {
      // declare common Node globals as readonly so ESLint doesn't flag them as undefined
      globals: {
        process: "readonly",
        console: "readonly",
        Buffer: "readonly",
        setTimeout: "readonly",
      },
      parserOptions: { sourceType: "module" },
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: { project: true, tsconfigRootDir: import.meta.dirname },
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        { allowNumber: true },
      ],
      // TODO: shadcn系統だけオフにしたいが、ぐちゃぐちゃすぎてshadcnがどれだか分からないので一旦全体オフ
      "react-refresh/only-export-components": "off",
      // 'react-refresh/only-export-components': ['error', {
      //     allowExportNames: ['meta', 'links', 'headers', 'loader', 'action'],
      // }],
      "react/self-closing-comp": "error",
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "react",
              importNames: ["default"],
              message:
                "Use named imports from 'react' instead of default import. For example: import { useEffect, useState } from 'react'",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["tests/**/*.ts", "tests/**/*.tsx"],
    languageOptions: {
      globals: {
        describe: "readonly",
        it: "readonly",
        test: "readonly",
        expect: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        vi: "readonly",
      },
      parserOptions: { project: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
);
