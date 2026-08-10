import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

// Crit 2's spec (comp.anu.edu.au/.../crits/02-unsolicited-redesign) asks for a
// real organisation's site, restructured with real information, not pasted
// wholesale. These check the mechanically-checkable lines against the BUILT
// site. "Yours is better in some way you can articulate" and "you can account
// for how you directed the agent" are judged at the crit, not here.

function page(path: string) {
  return new JSDOM(readFileSync(resolve("dist", path), "utf8")).window.document;
}

const home = page("index.html");
const download = page("download/index.html");
const faq = page("faq/index.html");

describe("links to the real organisation", () => {
  it("home page links to the real 7-zip.org", () => {
    const links = [...home.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    expect(links.some((href) => href?.includes("7-zip.org"))).toBe(true);
  });
});

describe("serves real information, not a placeholder", () => {
  it("home page carries real 7-Zip facts", () => {
    const text = home.body.textContent ?? "";
    expect(text).toMatch(/LZMA/);
    expect(text).toMatch(/7z/);
  });

  it("download page covers the real platforms 7-Zip ships for", () => {
    const text = download.body.textContent ?? "";
    for (const platform of ["Windows", "Linux", "macOS"]) {
      expect(text).toContain(platform);
    }
  });

  it("FAQ page has substantial real content, not a stub", () => {
    expect(faq.querySelectorAll("details").length).toBeGreaterThanOrEqual(10);
  });
});

describe("navigation reaches every page", () => {
  for (const [name, doc] of [
    ["home", home],
    ["download", download],
    ["faq", faq],
  ] as const) {
    it(`${name} page links to Home, Download, and FAQ`, () => {
      const nav = doc.querySelector("nav");
      const text = nav?.textContent ?? "";
      expect(text).toMatch(/Home/);
      expect(text).toMatch(/Download/);
      expect(text).toMatch(/FAQ/);
    });
  }
});

describe("static, no backend", () => {
  it("pages don't call out to a backend API", () => {
    for (const doc of [home, download, faq]) {
      const scripts = [...doc.querySelectorAll("script")];
      expect(scripts.every((s) => !s.textContent?.includes("fetch("))).toBe(true);
    }
  });
});
