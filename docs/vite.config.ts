import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@claudiu-ceia/ts-duckling": fileURLToPath(
        new URL("../mod.ts", import.meta.url),
      ),
      "@claudiu-ceia/combine": fileURLToPath(
        new URL("./node_modules/@claudiu-ceia/combine/mod.js", import.meta.url),
      ),
      "@data": fileURLToPath(new URL("../data", import.meta.url)),
    },
  },
  server: {
    fs: {
      allow: [".."],
    },
  },
  base: "/ts-duckling/",
  build: {
    outDir: "dist",
  },
});
