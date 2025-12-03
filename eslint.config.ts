import eslint from '@eslint/js';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    eslint.configs.recommended,
    {
        settings: {
            react: { version: 'detect' },
        },
    },
    ...tseslint.configs.strictTypeChecked.map(cfg => ({
        ...cfg,
        files: ['**/*.{ts,tsx}'],
    })),
    react.configs.flat.recommended,
    react.configs.flat['jsx-runtime'],
    reactHooks.configs['recommended-latest'],
    reactRefresh.configs.vite,
    {
        ignores: [
            'build/**/*',
            'dist/**/*',
            'node_modules/**/*',
            '.react-router/**/*',
            '.history/**/*',
            '.vscode/**/*',
            '.husky/**/*',
            '**/*.d.ts',
            'src/app/components/ui/shadcn/**',
            'src/extension/**',
            'coverage/**/*',
            'tmp_test_data/**/*',
        ],
    },
    {
        files: ['scripts/**/*.js', 'scripts/**/*.ts'],
        languageOptions: {
            globals: {
                process: 'readonly',
                console: 'readonly',
                Buffer: 'readonly',
                setTimeout: 'readonly',
            },
            parserOptions: { sourceType: 'module' },
        },
    },
    {
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
            parserOptions: { project: true, tsconfigRootDir: import.meta.dirname },
        },
        settings: {
            react: { version: 'detect' },
        },
        rules: {
            '@typescript-eslint/restrict-template-expressions': [
                'error',
                { allowNumber: true },
            ],
            '@typescript-eslint/no-unnecessary-condition': 'warn',
            '@typescript-eslint/no-confusing-void-expression': [
                'error',
                { ignoreArrowShorthand: true },
            ],
            '@typescript-eslint/consistent-type-imports': [
                'error',
                { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
            ],
            '@typescript-eslint/no-unused-vars': [
                'error',
                { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
            ],
            '@typescript-eslint/no-non-null-assertion': 'warn',
            '@typescript-eslint/only-throw-error': 'warn',
            '@typescript-eslint/require-await': 'warn',
            '@typescript-eslint/unbound-method': 'warn',
            '@typescript-eslint/no-unsafe-enum-comparison': 'warn',
            '@typescript-eslint/no-redundant-type-constituents': 'warn',
            '@typescript-eslint/no-unnecessary-type-parameters': 'warn',
            '@typescript-eslint/no-deprecated': 'off',
            '@typescript-eslint/no-explicit-any': 'error',
            '@typescript-eslint/no-unsafe-assignment': 'error',
            '@typescript-eslint/no-unsafe-member-access': 'error',
            '@typescript-eslint/no-unsafe-call': 'error',
            '@typescript-eslint/no-unsafe-return': 'error',
            'react-refresh/only-export-components': [
                'warn',
                { allowExportNames: ['meta', 'links', 'headers', 'loader', 'action'] },
            ],
            'react/self-closing-comp': 'error',
            'react/jsx-curly-brace-presence': [
                'error',
                { props: 'never', children: 'never' },
            ],
            'react/jsx-boolean-value': ['error', 'never'],
            'no-console': ['warn', { allow: ['warn', 'error', 'info', 'debug'] }],
            'no-empty': 'warn',
            'no-restricted-imports': [
                'error',
                {
                    paths: [
                        {
                            name: 'react',
                            importNames: ['default'],
                            message:
                                "Use named imports from 'react' instead of default import. For example: import { useEffect, useState } from 'react'",
                        },
                    ],
                },
            ],
        },
    },
    {
        files: ['tests/**/*.ts', 'tests/**/*.tsx', '**/*.test.ts', '**/*.test.tsx'],
        languageOptions: {
            globals: {
                describe: 'readonly',
                it: 'readonly',
                test: 'readonly',
                expect: 'readonly',
                beforeEach: 'readonly',
                afterEach: 'readonly',
                beforeAll: 'readonly',
                afterAll: 'readonly',
                vi: 'readonly',
            },
            parserOptions: { project: true, tsconfigRootDir: import.meta.dirname },
        },
        rules: {
            '@typescript-eslint/no-unused-vars': 'off',
            '@typescript-eslint/no-unsafe-assignment': 'off',
            '@typescript-eslint/no-unsafe-member-access': 'off',
            '@typescript-eslint/no-unsafe-call': 'off',
            '@typescript-eslint/no-unsafe-argument': 'off',
            '@typescript-eslint/no-unsafe-return': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-floating-promises': 'off',
            '@typescript-eslint/no-unnecessary-condition': 'off',
            '@typescript-eslint/require-await': 'off',
            '@typescript-eslint/no-redundant-type-constituents': 'off',
            'no-console': 'off',
            'no-empty': 'off',
        },
    },
    {
        files: ['src/server/**/*.ts'],
        rules: {
            'no-console': 'off',
        },
    },
);
