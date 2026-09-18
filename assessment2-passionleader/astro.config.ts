import { defineConfig, fontProviders } from "astro/config";
import courseGraph from "astro-course-university";
import universityTheme from "astro-theme-university";
import { astromotion, deckRemarkPlugins } from "astromotion";
import { courseMeta } from "./src/course-config.ts";
import { courseApiCollections } from "./src/site-config.ts";
import { gitOrigin, resolveDeployment } from "./scripts/pages-base.ts";

// Derived, never hardcoded --- see scripts/pages-base.ts for why.
const { site, base } = resolveDeployment(process.env, gitOrigin);

export default defineConfig({
  site,
  base,
  // Pages build as directories, so every route URL ends in a slash. Saying so
  // explicitly makes Astro emit matching links, which keeps the canonical URL
  // and what a visitor clicks in agreement --- otherwise each click costs a
  // 301 on GitHub Pages.
  trailingSlash: "always",
  // Course-level font, on top of the theme's own Public Sans/Roboto Mono
  // registration (astro-theme-university/index.ts dedupes by name, so this
  // doesn't collide). site.css/decks/theme.css point --at-font-body at this
  // instead of Public Sans; --at-font-mono (code) is untouched. Titillium
  // Web isn't shipped as a variable font by Google, so weights are listed
  // discretely rather than as a single "100 900" range.
  fonts: [
    {
      name: "Titillium Web",
      cssVariable: "--font-titillium-web",
      provider: fontProviders.google(),
      weights: ["400", "600", "700"],
    },
  ],
  integrations: [
    universityTheme({
      defaultLayout: "src/layouts/PageLayout.astro",
      // SlopU's palette is a fixed part of the platform (per the starter
      // README and the assignment brief: "SlopU's name, marks and palette
      // ... stay as they arrived") --- not a course-level styling choice.
      // site.css layers course-owned styling (e.g. the nav surface) on top,
      // using those fixed tokens rather than redefining them.
      brandCss: ["astro-theme-slop/slop.css", "/src/styles/site.css"],
      imageFormat: "avif",
      llmsTxt: true,
      // The theme owns the markdown plugin chain, so astromotion's slide
      // plugins (slide breaks, classes, backgrounds, notes, QR codes) are
      // handed to it rather than registered separately. Each one gates on
      // `.deck.mdx`, so ordinary pages are untouched.
      extraRemarkPlugins: deckRemarkPlugins,
    }),
    courseGraph({
      collections: courseApiCollections,
      timezone: "Australia/Canberra",
      course: courseMeta,
      canonicalUrl: `https://courses.slop.university/${courseMeta.code}/`,
    }),
    // Slide decks: every `.deck.mdx` under src/decks/ becomes a Reveal.js page
    // at /decks/<name>/. The theme's deck stylesheet reads the same brand
    // tokens the site does, so a deck arrives already wearing the Slop palette
    // --- see src/decks/theme.css. `fontVariables` makes the deck page emit the
    // @font-face for the theme's body font, which the deck styles ask for by
    // name.
    astromotion({
      theme: "./src/decks/theme.css",
      fontVariables: ["--font-public-sans", "--font-titillium-web"],
    }),
  ],
});
