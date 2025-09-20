import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tailwindcss(), reactRouter(), tsconfigPaths()],
  server: {
    proxy: {
      // Socket.IO のパスをバックエンドサーバーにプロキシ
      "/socket.io": {
        target: "http://localhost:3000",
        changeOrigin: true,
        ws: true, // WebSocket サポート
      },
      // APIパスもプロキシ（必要に応じて）
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
