import { reactRouter } from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
    optimizeDeps: {
        include: ['socket.io-client', 'framer-motion', 'zustand'],
    },
    plugins: [tailwindcss(), reactRouter(), tsconfigPaths()],
    server: {
        proxy: {
            '/socket.io': {
                changeOrigin: true,
                target: 'http://localhost:3000',
                ws: true,
            },
        },
    },
});
