import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { defineConfig } from 'vite';

const rootDir = resolve(__dirname);

export default defineConfig({
    root: rootDir,
    base: './',
    // @ts-ignore - bun cached type definition mismatch with vite 6.x
    plugins: [tailwindcss(), react()],
    build: {
        rollupOptions: {
            input: {
                popup: resolve(rootDir, 'src/popup/index.html'),
                background: resolve(rootDir, 'src/background/sw.ts'),
                content: resolve(rootDir, 'src/content/content.ts'),
                offscreen: resolve(rootDir, 'src/offscreen/index.html'),
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
