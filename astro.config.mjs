import { defineConfig } from "astro/config";

// The deployed site lives under https://<user>.github.io/comp4020-crit2-passionleader/,
// so every internal asset and link needs that base path baked in (see src/consts.ts).
export default defineConfig({
  site: "https://passionleader.github.io",
  base: "/comp4020-crit2-passionleader",
  outDir: "dist",
});
