import { defineConfig } from "astro/config";

// This copy is hosted from the personal archive repo, under
// https://passionleader.github.io/anu-agentic-coding-studio/crit2-passionleader/,
// so every internal asset and link needs that base path baked in (see src/consts.ts).
export default defineConfig({
  site: "https://passionleader.github.io",
  base: "/anu-agentic-coding-studio/crit2-passionleader",
  outDir: "dist",
});
