import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

// Checks the parts of the Crit 4 brief that a static read of the built site
// can verify. The behavioural contract (pressing a pad plays a chord and
// grows the progression) lives in spec/pads.test.ts instead, since that
// needs the interaction to actually run.
const DIST = resolve("dist");

function files(dir: string = DIST): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}

const shipped = files().map((path) => relative(DIST, path).split(sep).join("/"));
const doc = new JSDOM(readFileSync(join(DIST, "index.html"), "utf8")).window.document;

describe("Chord Session: build output", () => {
  it("ships no prerecorded audio, so sound can only come from live synthesis", () => {
    const prerecorded = shipped.filter((name) => /\.(mp3|wav|ogg|m4a|flac)$/i.test(name));
    expect(prerecorded).toEqual([]);
    expect(doc.querySelectorAll("audio, video")).toHaveLength(0);
  });

  it("names the instrument in the title", () => {
    expect(doc.title).toContain("Chord Session");
  });

  it("has a labelled mount point for the chord pads", () => {
    const pads = doc.querySelector("#pad-grid");
    expect(pads).toBeTruthy();
    expect(pads?.getAttribute("role")).toBe("group");
    expect(pads?.getAttribute("aria-label")).toBeTruthy();
  });

  it("has mount points for the progression and status areas", () => {
    expect(doc.querySelector("#progression-list")).toBeTruthy();
    expect(doc.querySelector("#status-line")).toBeTruthy();
  });

  it("announces state changes politely for screen reader users", () => {
    const announcer = doc.querySelector("#sr-announcer");
    expect(announcer?.getAttribute("aria-live")).toBe("polite");
  });

  it("gives Clear a real, keyboard-reachable button element", () => {
    const clearButton = doc.querySelector("#clear-button");
    expect(clearButton?.tagName).toBe("BUTTON");
    expect(clearButton?.getAttribute("type")).toBe("button");
  });
});
