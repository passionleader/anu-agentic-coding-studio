import { readFileSync, readdirSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

// Turns the mechanically-checkable lines of the Crit 1 spec ("Forgotten web")
// into tests. Judged-by-a-person lines — "the look commits to a web era the
// modern web has forgotten" — aren't testable and are answered at the crit
// instead. See spec/README.md.
const DIST = resolve("dist");

function allFiles(dir: string = DIST): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return allFiles(path);
    return [path];
  });
}

const files = allFiles();
const htmlFiles = files.filter((f) => extname(f) === ".html");
const pages = htmlFiles.map((path) => ({
  name: relative(DIST, path),
  doc: new JSDOM(readFileSync(path, "utf8")).window.document,
}));

describe('spec: "no JavaScript"', () => {
  it("ships no script tags", () => {
    for (const { name, doc } of pages) {
      expect(
        doc.querySelectorAll("script").length,
        `${name} has a <script> tag — the spec rules out JavaScript this week`,
      ).toBe(0);
    }
  });

  it("ships no .js files", () => {
    const jsFiles = files.filter((f) => extname(f) === ".js");
    expect(jsFiles, `built .js files: ${jsFiles.join(", ")}`).toEqual([]);
  });
});

describe('spec: "a handful of pages ... each reachable from the home page"', () => {
  it("is more than a single page", () => {
    expect(
      pages.length,
      "only one page built — a 'real site' needs a handful of pages",
    ).toBeGreaterThan(1);
  });

  it("reaches every page from the home page", () => {
    const home = pages.find(({ name }) => name === "index.html");
    expect(home, "no index.html in dist/").toBeTruthy();
    if (!home) return;

    const seen = new Set<string>(["index.html"]);
    const queue = ["index.html"];
    while (queue.length) {
      const current = queue.pop()!;
      const page = pages.find(({ name }) => name === current);
      if (!page) continue;
      for (const a of page.doc.querySelectorAll("a[href]")) {
        const href = a.getAttribute("href") ?? "";
        const target = href.replace(/^\.\//, "").replace(/^#.*/, "");
        if (target && htmlFiles.some((f) => relative(DIST, f) === target) && !seen.has(target)) {
          seen.add(target);
          queue.push(target);
        }
      }
    }

    const unreached = pages.map((p) => p.name).filter((name) => !seen.has(name));
    expect(unreached, `unreachable from home: ${unreached.join(", ")}`).toEqual([]);
  });
});
