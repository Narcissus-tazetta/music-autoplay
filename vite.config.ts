import { reactRouter } from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
    optimizeDeps: {
        include: ['socket.io-client', 'framer-motion', 'zustand'],
    },
    plugins: [tailwindcss(), reactRouter()],
    resolve: {
        tsconfigPaths: true,
    },
    server: {
        hmr: false,
        host: '0.0.0.0',
        proxy: {
            '/socket.io': {
                changeOrigin: true,
                target: 'http://localhost:3000',
                ws: true,
            },
        },
    },
});
