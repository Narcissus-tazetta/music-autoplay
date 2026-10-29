import type { KnipConfig } from 'knip';

// Only the roots knip cannot infer on its own. The react-router plugin already contributes
// the server entry, root, route config and the vite/react-router configs; listing them again
// makes knip report them as redundant.
export default {
    entry: [
        'src/app/routes/**/*.{ts,tsx}',
        'src/app/components/ui/shadcn/*.{ts,tsx}',
        'tests/**/*.test.{ts,tsx}',
        'youtube-auto-play/src/**/*.ts',
    ],
    project: ['src/**/*.{ts,tsx}', 'tests/**/*.{ts,tsx}'],
} satisfies KnipConfig;
