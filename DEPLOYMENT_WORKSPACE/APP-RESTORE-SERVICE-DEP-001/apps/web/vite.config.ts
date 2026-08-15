import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";


export default defineConfig({
  root: ".",
  base: "/",
  plugins: [react()],
  worker: {
    format: "iife",
    rolldownOptions: {
      output: {
        entryFileNames: "service-worker.js"
      }
    }
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false
  }
});
