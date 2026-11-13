import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  buildGroupRow,
  caseLabelOptions,
  compileDedupe,
  dedupeFunctions,
  evaluateDedupe,
  groupHash,
  validateLabels,
} from "./dedupe-page.js";

const tab = JSON.parse(
  await readFile(
    new URL("../../../test/fixtures/dedupe-page.json", import.meta.url),
  ),
);
const config = compileDedupe(tab["page-type"].configuration);
const a = {
  caseRef: "a",
  labels: [],
  currentStatus: "APPLICATION_IN_REVIEW",
  payload: { answers: { applicant: { business: { name: "Old name" } } } },
};
const b = { ...a, caseRef: "b", labels: [] };
const row = () =>
  buildGroupRow(
    { key: { sbi: "123" }, cases: structuredClone([a, b]) },
    null,
    config,
    "type",
    "duplicates",
  );
describe("configured dedupe page", () => {
  it("resolves the five functions and derives completion from active cases only", () => {
    const group = row();
    expect(group.details.notSet).toBe(2);
    expect(group.details.businessName).toBe("Old name");
    expect(group.status.tag).toBe("NOT_STARTED");
    group.cases[0].labels.push({
      namespace: "duplicates",
      code: "NOT_DUPLICATE",
    });
    expect(dedupeFunctions.groupStatus(group.cases, "duplicates")).toBe(
      "IN_PROGRESS",
    );
    group.cases[1].labels.push({
      namespace: "duplicates",
      code: "DUPLICATE",
      data: { duplicateOf: "a" },
    });
    expect(dedupeFunctions.groupStatus(group.cases, "duplicates")).toBe(
      "COMPLETED",
    );
    expect(
      dedupeFunctions.labelCount(group.cases, "DUPLICATE", "duplicates"),
    ).toBe(1);
    expect(dedupeFunctions.labelCount(group.cases, "DUPLICATE", "other")).toBe(
      0,
    );
    expect(
      evaluateDedupe("function:count(@.cases)", { "@": group }, "duplicates"),
    ).toBe(2);
  });
  it("rejects functions, paths, ambiguous keys and unsupported strategies when loaded", () => {
    for (const expression of [
      "function:missing(@.cases)",
      "@.key.missing",
      "function:count(@.cases, 'extra')",
      "function:first(@.cases, $case.payload.name)",
    ]) {
      const input = structuredClone(config);
      input.data.details.sbi = expression;
      expect(() => compileDedupe(input)).toThrow();
    }
    expect(() =>
      compileDedupe({
        ...config,
        groupBy: [...config.groupBy, ...config.groupBy],
      }),
    ).toThrow();
    expect(() =>
      compileDedupe({
        ...config,
        groupBy: [{ ...config.groupBy[0], normalise: "uppercase" }],
      }),
    ).toThrow();
  });
  it("uses typed, canonical, page-specific keys", () => {
    expect(groupHash("t", "p", { a: 1, b: "x" })).toBe(
      groupHash("t", "p", { b: "x", a: 1 }),
    );
    expect(groupHash("t", "p", { a: 1 })).not.toBe(
      groupHash("t", "p", { a: "1" }),
    );
    expect(groupHash("t", "p", { a: 1 })).not.toBe(
      groupHash("t", "other", { a: 1 }),
    );
  });
  it("refuses cross-group, self, excluded, missing-target and unknown labels", () => {
    const group = row();
    const invalid = [
      { missing: null },
      { a: { code: "MISSING" } },
      { a: { code: "DUPLICATE" } },
      ...["a", "missing"].map((duplicateOf) => ({
        a: { code: "DUPLICATE", data: { duplicateOf } },
      })),
    ];
    for (const labels of invalid)
      expect(() => validateLabels(group, labels, config)).toThrow();
    group.activeCases = [group.cases[1]];
    expect(() => validateLabels(group, { a: null }, config)).toThrow();
    expect(caseLabelOptions(group, b, config)).toHaveLength(2);
  });
  it("retains unchanged historical references after the target is excluded", () => {
    const group = row();
    group.cases[1].labels = [
      {
        namespace: "duplicates",
        code: "DUPLICATE",
        data: { duplicateOf: "a" },
      },
    ];
    group.activeCases = [group.cases[1]];
    expect(() =>
      validateLabels(
        group,
        { b: { code: "DUPLICATE", data: { duplicateOf: "a" } } },
        config,
      ),
    ).not.toThrow();
  });
});
