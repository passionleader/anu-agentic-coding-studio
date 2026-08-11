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
const sevenZFormat = page("7z-format/index.html");
const lzmaSdk = page("lzma-sdk/index.html");
const support = page("support/index.html");
const links = page("links/index.html");

const allPages = [
  ["home", home],
  ["download", download],
  ["faq", faq],
  ["7z-format", sevenZFormat],
  ["lzma-sdk", lzmaSdk],
  ["support", support],
  ["links", links],
] as const;

describe("links to the real organisation", () => {
  it("home page links to the real 7-zip.org", () => {
    const hrefs = [...home.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    expect(hrefs.some((href) => href?.includes("7-zip.org"))).toBe(true);
  });

  it("download page links straight to real GitHub release assets", () => {
    const hrefs = [...download.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    expect(hrefs.some((href) => href?.startsWith("https://github.com/ip7z/7zip/releases/download/"))).toBe(
      true,
    );
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

  it("7z Format page carries real facts about the format", () => {
    const text = sevenZFormat.body.textContent ?? "";
    expect(text).toMatch(/AES-256/);
    expect(text).toMatch(/LZMA/);
  });

  it("LZMA SDK page states the real public-domain license", () => {
    const text = lzmaSdk.body.textContent ?? "";
    expect(text).toMatch(/public domain/i);
  });

  it("Support page names real support channels", () => {
    const hrefs = [...support.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    expect(hrefs.some((href) => href?.includes("sourceforge.net/p/sevenzip"))).toBe(true);
  });

  it("Links page links to the real project repositories", () => {
    const hrefs = [...links.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    expect(hrefs.some((href) => href?.includes("github.com/ip7z/7zip"))).toBe(true);
  });
});

describe("navigation reaches every page", () => {
  for (const [name, doc] of allPages) {
    it(`${name} page links to every nav item`, () => {
      const nav = doc.querySelector("nav");
      const text = nav?.textContent ?? "";
      for (const item of ["Home", "7z Format", "LZMA SDK", "Download", "FAQ", "Support", "Links"]) {
        expect(text).toContain(item);
      }
    });
  }
});

describe("static, no backend", () => {
  it("pages don't call out to a backend API", () => {
    for (const [, doc] of allPages) {
      const scripts = [...doc.querySelectorAll("script")];
      expect(scripts.every((s) => !s.textContent?.includes("fetch("))).toBe(true);
    }
  });
});
