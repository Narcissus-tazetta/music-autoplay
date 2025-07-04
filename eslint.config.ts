import dprint from '@ben_12/eslint-plugin-dprint';
import eslint from '@eslint/js';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

// TODO: eslint-plugin-jsdocは入っているが、どこまで適用するかが未定のため、未使用

export default tseslint.config(
    eslint.configs.recommended,
    tseslint.configs.strictTypeChecked.map(cfg => ({ ...cfg, files: ['**/*.{ts,tsx}'] })),
    react.configs.flat.recommended,
    react.configs.flat['jsx-runtime'],
    reactHooks.configs['recommended-latest'],
    reactRefresh.configs.vite,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    {
        // @ts-expect-error eslint-dprint-pluginの型情報の不足によるエラーを回避
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        ...dprint.configs['disable-typescript-conflict-rules'],
        plugins: { dprint },
    },
    { ignores: ['build/**/*', 'dist/**/*', 'node_modules/**/*', '.react-router/**/*', '**/*.d.ts'] },
    {
        files: ['**/*.{ts,tsx}'],
        languageOptions: { parserOptions: { project: true, tsconfigRootDir: import.meta.dirname } },
        rules: { '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }] },
    },
);
