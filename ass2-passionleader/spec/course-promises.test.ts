import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

interface AssessmentMeta {
  week: number;
  due: string;
  weight: number;
  marking?:
    | { mode: "weighted"; criteria: { name: string; weight: number }[] }
    | { mode: "holistic"; description: string };
}

interface LectureMeta {
  teachers?: string[];
  slides?: string;
}

interface SessionMeta {
  teachers?: string[];
}

interface ApiNode {
  id: string;
  type: string;
  meta?: Record<string, unknown>;
}

interface CourseApi {
  nodes: ApiNode[];
}

const api = JSON.parse(readFileSync(resolve("dist/api/index.json"), "utf8")) as CourseApi;

const assessments = api.nodes.filter((node) => node.type === "assessments");
const people = api.nodes.filter((node) => node.type === "people");
const lecturesAndSessions = api.nodes.filter(
  (node) => node.type === "lectures" || node.type === "sessions",
);

describe("assessment weighting adds up to a full mark", () => {
  it("sums every assessment's course weight to exactly 100", () => {
    const total = assessments.reduce(
      (sum, node) => sum + Number((node.meta as unknown as AssessmentMeta).weight),
      0,
    );
    expect(total).toBe(100);
  });

  it("sums every weighted assessment's own criteria to exactly 100", () => {
    for (const node of assessments) {
      const marking = (node.meta as unknown as AssessmentMeta).marking;
      if (marking?.mode !== "weighted") continue;
      const total = marking.criteria.reduce((sum, criterion) => sum + criterion.weight, 0);
      expect(total, `${node.id}'s criteria`).toBe(100);
    }
  });
});

describe("every named teacher has a real profile", () => {
  const peopleIds = new Set(people.map((node) => node.id.replace(/^people\//, "")));

  it("resolves every lectures/sessions teacher id to a people entry", () => {
    for (const node of lecturesAndSessions) {
      const teachers = (node.meta as unknown as LectureMeta | SessionMeta).teachers ?? [];
      for (const teacher of teachers) {
        expect(peopleIds.has(teacher), `${node.id} names unknown teacher "${teacher}"`).toBe(true);
      }
    }
  });
});

describe("a lecture that promises slides actually ships a deck", () => {
  it("has a built page at the deck path every lecture's slides field names", () => {
    const withSlides = api.nodes.filter(
      (node) => node.type === "lectures" && (node.meta as unknown as LectureMeta).slides,
    );
    expect(withSlides.length, "at least one lecture should carry a real deck").toBeGreaterThan(0);
    for (const node of withSlides) {
      const slidesPath = (node.meta as unknown as LectureMeta).slides as string;
      const builtPage = resolve("dist", slidesPath.replace(/^\//, ""), "index.html");
      expect(existsSync(builtPage), `${node.id} names ${slidesPath}, but ${builtPage} was not built`).toBe(
        true,
      );
    }
  });
});
