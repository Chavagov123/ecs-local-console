import path from "path";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";

const API_TARGET = process.env.API_TARGET ?? "http://localhost:4570";

export default defineConfig({
  server: {
    host: true,
    port: 8080,
    proxy: {
      "/api": { target: API_TARGET, changeOrigin: true },
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist",
  },
});
