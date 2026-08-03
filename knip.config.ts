import type { KnipConfig } from 'knip';

// The previous config listed only the shadcn directory as an entry point, so knip reported
// every route, every test and the whole server tree as "unused" - about 100 false positives,
// which made the tool useless (it also flagged genuinely-used packages as unused deps).
export default {
    entry: [
        'src/server/server.ts',
        'src/app/root.tsx',
        'src/app/routes.ts',
        'src/app/routes/**/*.{ts,tsx}',
        'src/app/components/ui/shadcn/*.{ts,tsx}',
        'tests/**/*.test.{ts,tsx}',
        'youtube-auto-play/src/**/*.ts',
        'vite.config.ts',
        'react-router.config.ts',
    ],
    ignore: ['build/**', 'youtube-auto-play/dist/**', '.react-router/**'],
    project: ['src/**/*.{ts,tsx}', 'tests/**/*.{ts,tsx}'],
} satisfies KnipConfig;
