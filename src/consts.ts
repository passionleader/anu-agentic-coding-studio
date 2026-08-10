// The site deploys under https://<user>.github.io/comp4020-crit2-passionleader/,
// so every internal href is built from this rather than hardcoded as "/…" —
// a bare root-relative link 404s under the GitHub Pages subpath. BASE_URL
// itself doesn't guarantee a trailing slash, so normalise it here rather than
// at every call site.
const rawBase = import.meta.env.BASE_URL;
export const BASE = rawBase.endsWith("/") ? rawBase : `${rawBase}/`;

export const ORIGINAL_SITE_URL = "https://www.7-zip.org/";
