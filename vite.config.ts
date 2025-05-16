import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import cartographer from "@replit/vite-plugin-cartographer";
import runtimeErrorModal from "@replit/vite-plugin-runtime-error-modal";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Ottieni __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [
    react(),
    cartographer(),
    runtimeErrorModal(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
      "@assets": path.resolve(__dirname, "attached_assets"),
    },
  },
  build: {
    root: path.resolve(__dirname, "client"),
    emptyOutDir: true,
    outDir: path.resolve(__dirname, "dist/public"),
  },
});
