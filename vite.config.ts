/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Multiple standalone HTML entry points (the Phaser battlefield prototype,
// the layered Card Builder) sit alongside the main React app's index.html.
// Vite's dev server serves any .html file it finds automatically, but
// `vite build` only emits what's listed here — omitting an entry doesn't
// error, it just silently 404s that page once deployed. Paths are relative
// to this file's directory (Vite's project root).
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: "index.html",
        phaser: "phaser.html",
        cardBuilder: "card-builder.html",
      },
    },
  },
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.ts"],
  },
});
