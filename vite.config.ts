import { reactRouter } from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
    plugins: [tailwindcss(), reactRouter(), tsconfigPaths()],
    optimizeDeps: {
        include: ['socket.io-client', 'framer-motion', 'zustand'],
        force: false,
    },
    server: {
        proxy: {
            '/socket.io': {
                target: 'http://localhost:3000',
                changeOrigin: true,
                ws: true,
            },
        },
    },
    build: {
        rollupOptions: {},
    },
});
