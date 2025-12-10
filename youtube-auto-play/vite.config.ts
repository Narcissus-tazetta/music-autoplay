import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { defineConfig } from 'vite';

const rootDir = resolve(__dirname);

export default defineConfig({
    root: rootDir,
    plugins: [tailwindcss(), react()],
    build: {
        rollupOptions: {
            input: {
                popup: resolve(rootDir, 'src/popup/index.html'),
                background: resolve(rootDir, 'src/background/background.ts'),
                content: resolve(rootDir, 'src/content/content.ts'),
            },
            output: {
                entryFileNames: '[name].js',
                chunkFileNames: 'assets/[name]-[hash].js',
                assetFileNames: 'assets/[name]-[hash][extname]',
                format: 'es',
            },
        },
        outDir: resolve(rootDir, 'dist'),
    },
});
