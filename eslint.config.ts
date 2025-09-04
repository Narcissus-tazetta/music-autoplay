import dprint from "@ben_12/eslint-plugin-dprint";
import eslint from "@eslint/js";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

// TODO: eslint-plugin-jsdocは入っているが、どこまで適用するかが未定のため、未使用

export default tseslint.config(
  eslint.configs.recommended,
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
      "scripts/**/*",
      "**/*.d.ts",
    ],
  },
  // Relax rules for generated shadcn UI components which intentionally use looser typing
  {
    files: ["src/components/ui/shadcn/**", "src/app/components/ui/shadcn/**"],
    rules: {
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unnecessary-condition": "off",
      "@typescript-eslint/no-base-to-string": "off",
      "@typescript-eslint/no-floating-promises": "off",
      "@typescript-eslint/no-misused-promises": "off",
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
    },
  },
);
