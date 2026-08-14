import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Base is "./" so the production build can be dropped onto any static host
// (GitHub Pages, a sub-path on Netlify/Vercel, etc.) without extra config.
export default defineConfig({
  plugins: [react()],
  base: "./",
});
