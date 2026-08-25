import { describe, expect, it } from "vitest";
import { CHORDS, type ChordId, rankNextChords, voiceChordTones } from "../chords.ts";

const ALL_IDS = Object.keys(CHORDS) as ChordId[];

describe("rankNextChords", () => {
  it("always offers exactly six chords, from the empty progression too", () => {
    expect(rankNextChords([])).toHaveLength(6);
    for (const id of ALL_IDS) {
      expect(rankNextChords([id])).toHaveLength(6);
    }
  });

  it("never suggests the chord that was just played", () => {
    for (const id of ALL_IDS) {
      const candidates = rankNextChords([id]);
      expect(candidates.some((ranked) => ranked.chord.id === id)).toBe(false);
    }
  });

  it("never repeats a chord within one set of suggestions", () => {
    for (const progression of [[], ...ALL_IDS.map((id) => [id])]) {
      const candidates = rankNextChords(progression);
      expect(new Set(candidates.map((ranked) => ranked.chord.id)).size).toBe(candidates.length);
    }
  });

  it("changes what it suggests based on what was just played", () => {
    const afterI = rankNextChords(["I"]).map((ranked) => ranked.chord.id);
    const afterVi = rankNextChords(["vi"]).map((ranked) => ranked.chord.id);
    expect(afterI).not.toEqual(afterVi);
  });

  it("is deterministic for the same non-empty progression", () => {
    expect(rankNextChords(["ii", "V"])).toEqual(rankNextChords(["ii", "V"]));
  });

  it("labels every suggestion with a confidence tier, two of each", () => {
    for (const progression of [[], ["I"], ["ii", "V"]] as ChordId[][]) {
      const tally = { safe: 0, colour: 0, surprise: 0 };
      for (const ranked of rankNextChords(progression)) {
        tally[ranked.tier] += 1;
      }
      expect(tally).toEqual({ safe: 2, colour: 2, surprise: 2 });
    }
  });

  it("resolves a ii-V cadence to the tonic", () => {
    expect(rankNextChords(["ii", "V"])[0]?.chord.id).toBe("I");
  });

  it("continues the I-V-vi-IV loop rather than only resolving to I", () => {
    expect(rankNextChords(["I", "V"])[0]?.chord.id).toBe("vi");
  });

  it("only ever recommends chords from the curated vocabulary", () => {
    for (const progression of [[], ["I"], ["V7"]] as ChordId[][]) {
      for (const ranked of rankNextChords(progression)) {
        expect(ALL_IDS).toContain(ranked.chord.id);
      }
    }
  });

  it("keeps a balanced, musically compatible starter set even though it is randomised", () => {
    for (let i = 0; i < 25; i++) {
      const ids = rankNextChords([]).map((ranked) => ranked.chord.id);
      expect(new Set(ids).size).toBe(6);
      expect(ids.some((id) => CHORDS[id].category === "tonic")).toBe(true);
      expect(ids.some((id) => CHORDS[id].category === "subdominant" || CHORDS[id].category === "dominant")).toBe(
        true,
      );
    }
  });
});

describe("voiceChordTones", () => {
  it("plays root position when there is no previous voicing", () => {
    expect(voiceChordTones(CHORDS.I, null)).toEqual([60, 64, 67]);
  });

  it("reuses shared tones exactly when the next chord has close relatives", () => {
    const first = voiceChordTones(CHORDS.I, null);
    const next = voiceChordTones(CHORDS.vi, first);
    const shared = next.filter((note) => first.includes(note));
    expect(shared.length).toBeGreaterThanOrEqual(2);
  });

  it("keeps every voice within a comfortable register over a long progression", () => {
    const order: ChordId[] = ["I", "IV", "V", "vi", "ii", "iii", "V7", "bVII"];
    let voicing: number[] | null = null;
    for (let i = 0; i < 40; i++) {
      const chord = CHORDS[order[i % order.length] as ChordId];
      voicing = voiceChordTones(chord, voicing);
      for (const note of voicing) {
        expect(note).toBeGreaterThanOrEqual(55);
        expect(note).toBeLessThanOrEqual(79);
      }
    }
  });

  it("never places two voices of the same chord a clashing semitone apart", () => {
    for (const fromId of ALL_IDS) {
      const previous = voiceChordTones(CHORDS[fromId], null);
      for (const toId of ALL_IDS) {
        const voicing = voiceChordTones(CHORDS[toId], previous);
        const sorted = [...voicing].sort((a, b) => a - b);
        for (let i = 1; i < sorted.length; i++) {
          expect(sorted[i] - sorted[i - 1]).toBeGreaterThanOrEqual(2);
        }
      }
    }
  });
});
