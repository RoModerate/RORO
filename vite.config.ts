import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path, { dirname } from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal"
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [react(), runtimeErrorOverlay()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@db": path.resolve(__dirname, "db"),
    },
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    host: 'localhost',
    port: 5000,
    strictPort: false,
    hmr: {
      protocol: 'wss',
      host: process.env.REPL_SLUG 
        ? `${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
        : undefined,
      clientPort: 443,
    },
  },
});