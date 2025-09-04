import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type ServerOptions } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

const wsPort = process.env.VITE_WS_PORT
  ? Number(process.env.VITE_WS_PORT)
  : undefined;

const baseServer = {
  watch: {
    ignored: ["**/api-usage.json", "**/api-usage.json.backup"],
  },
};

const serverConfig = wsPort
  ? { ...baseServer, ws: { port: wsPort } }
  : baseServer;

export default defineConfig({
  plugins: [tailwindcss(), reactRouter(), tsconfigPaths()],
  server: serverConfig as ServerOptions,
});
