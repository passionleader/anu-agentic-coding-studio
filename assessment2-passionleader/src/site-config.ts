import { defineSiteConfig } from "astro-theme-university/types";
import { slopBranding } from "astro-theme-slop";
import { courseMeta } from "./course-config";

// The underlying collection and URL remain `sessions`; these labels are the
// language students see. This course runs them as small-group practicals
// where a technique gets rehearsed under supervision before anyone tries it
// on an unsuspecting public.
export const sessionLabels = {
  singular: "Drop-in Session",
  plural: "Drop-in Sessions",
} as const;

export const graphCollections = [
  "sessions",
  "assessments",
  "lectures",
  "tutorials",
  "quizzes",
  "people",
];

export const courseApiCollections = [
  ...graphCollections.map((key) => ({ key })),
  { key: "policies", dir: "pages/policies" },
];

export const siteConfig = defineSiteConfig({
  ...slopBranding,
  name: "Slop University",

  links: [
    { text: "Lectures", href: "/lectures/" },
    { text: "Tutorial", href: "/tutorials/" },
    { text: "Quiz", href: "/quizzes/" },
    { text: "Assessment", href: "/assessments/" },
    { text: sessionLabels.plural, href: "/sessions/" },
    { text: "People", href: "/people/" },
    { text: "Resources & Policies", href: "/policies/" },
  ],

  licence: "CC-BY-NC-SA-4.0",
  socialImage: "/src/assets/images/card.png",
  socialImageAlt: `A preview card for ${courseMeta.code}: ${courseMeta.title}`,

  // Bright/light brand ask: pin the theme to light mode rather than following
  // the viewer's system preference, so the site reads reliably light.
  colorScheme: "light",
});
