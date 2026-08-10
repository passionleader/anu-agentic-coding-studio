// The site deploys under https://<user>.github.io/comp4020-crit2-passionleader/,
// so every internal href is built from this rather than hardcoded as "/…" —
// a bare root-relative link 404s under the GitHub Pages subpath. BASE_URL
// itself doesn't guarantee a trailing slash, so normalise it here rather than
// at every call site.
const rawBase = import.meta.env.BASE_URL;
export const BASE = rawBase.endsWith("/") ? rawBase : `${rawBase}/`;

export const ORIGINAL_SITE_URL = "https://www.7-zip.org/";

// Mirrors the real site's own top nav (Home / 7z Format / LZMA SDK / Download
// / FAQ / Support / Links), so every page here reaches the same set of pages
// the original does, just restructured.
export const NAV_LINKS = [
  { href: BASE, label: "Home" },
  { href: `${BASE}7z-format/`, label: "7z Format" },
  { href: `${BASE}lzma-sdk/`, label: "LZMA SDK" },
  { href: `${BASE}download/`, label: "Download" },
  { href: `${BASE}faq/`, label: "FAQ" },
  { href: `${BASE}support/`, label: "Support" },
  { href: `${BASE}links/`, label: "Links" },
];
