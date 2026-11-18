import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { Case } from "./case.js";
import { DedupeGroup } from "./dedupe-group.js";
import { DedupeGroupKey } from "./dedupe-group-key.js";
import { DedupeError, assessmentFor } from "./dedupe-assessment.js";
import { GroupAssignment } from "./group-assignment.js";
import { compileDedupe } from "../schemas/dedupe-definition.js";

const tab = JSON.parse(
  await readFile(
    new URL("../../../test/fixtures/dedupe-page.json", import.meta.url),
  ),
);
const config = tab["page-type"].configuration;
const kase = (ref, label = null, currentStatus = "IN_REVIEW") => ({
  caseRef: ref,
  currentStatus,
  dedupeAssessment: label,
});
const group = (cases) =>
  new DedupeGroup(new DedupeGroupKey("type", { sbi: "123" }), cases, [
    "REJECTED",
  ]);
const notDuplicate = { code: "NOT_DUPLICATE" };
const duplicate = (ref) => ({ code: "DUPLICATE", duplicateOf: ref });

describe("dedupe domain", () => {
  it("derives status and counts, ignoring excluded cases", () => {
    const a = kase("a");
    const b = kase("b");
    expect(group([a, b, kase("x", notDuplicate, "REJECTED")]).status).toBe(
      "NOT_STARTED",
    );
    a.dedupeAssessment = notDuplicate;
    expect(group([a, b]).status).toBe("IN_PROGRESS");
    b.dedupeAssessment = duplicate("a");
    const completed = group([a, b]);
    expect(completed.status).toBe("COMPLETED");
    expect(completed.counts).toMatchObject({
      total: 2,
      notSet: 0,
      notDuplicate: 1,
      duplicate: 1,
    });
    expect(group([a, b, kase("new")]).status).toBe("IN_PROGRESS");
    expect(group([a, kase("x", null, "REJECTED")]).visible).toBe(false);
  });
  it("validates active targets and keeps unchanged historical references", () => {
    const review = group([
      kase("a", null, "REJECTED"),
      kase("b", duplicate("a")),
      kase("c"),
    ]);
    expect(review.validateLabels({ b: duplicate("a") })).toEqual({});
    expect(review.duplicateTargets("b").map((c) => c.caseRef)).toEqual(["c"]);
    for (const input of [
      { a: notDuplicate },
      { c: duplicate("c") },
      { c: duplicate("a") },
      { unknown: notDuplicate },
      { c: { code: "CUSTOM" } },
    ])
      expect(() => review.validateLabels(input)).toThrow(DedupeError);
  });
  it("rejects direct and indirect cycles across a whole submitted change", () => {
    const review = group([kase("a"), kase("b"), kase("c")]);
    expect(() =>
      review.validateLabels({ a: duplicate("b"), b: duplicate("a") }),
    ).toThrow(/cycle/);
    expect(() =>
      review.validateLabels({
        a: duplicate("b"),
        b: duplicate("c"),
        c: duplicate("a"),
      }),
    ).toThrow(/cycle/);
    expect(() =>
      review.validateLabels({ a: duplicate("b"), b: notDuplicate }),
    ).not.toThrow();
  });
  it("follows a cycle through stored out-of-scope historical references", () => {
    const review = group([kase("a"), kase("b", duplicate("outside"))]);
    expect(() =>
      review.validateLabels({ a: duplicate("b") }, [
        kase("outside", duplicate("a"), "REJECTED"),
      ]),
    ).toThrow(/cycle/);
  });
  it("lets Case own changed-only label mutation and the timeline event", () => {
    const instance = Case.createMock();
    expect(() =>
      instance.recordDedupeAssessment({
        assessment: duplicate(instance.caseRef),
        createdBy: "System",
      }),
    ).toThrow();
    const event = instance.recordDedupeAssessment({
      assessment: notDuplicate,
      createdBy: "System",
    });
    expect(assessmentFor(instance).code).toBe("NOT_DUPLICATE");
    expect(event.eventType).toBe("CASE_LABEL_CHANGED");
    expect(
      instance.recordDedupeAssessment({
        assessment: notDuplicate,
        createdBy: "System",
      }),
    ).toBeNull();
    instance.recordDedupeAssessment({ assessment: null, createdBy: "System" });
    expect(assessmentFor(instance)).toBeNull();
  });
  it("models assignment independently from calculated group membership", () => {
    const assignment = new GroupAssignment(
      new DedupeGroupKey("type", { sbi: "123" }),
    );
    expect(assignment.assign(null, [])).toBe(false);
    expect(() => assignment.assign("missing", [])).toThrow(/eligible/);
    expect(assignment.assign("u1", [{ id: "u1", name: "Alex" }])).toBe(true);
    expect(assignment.assign("u1", [{ id: "u1", name: "Alex" }])).toBe(false);
    expect(assignment.assign(null, [])).toBe(true);
  });
});
describe("dedupe identity and definition", () => {
  it("preserves types and canonical names, without page identity", () => {
    const key = new DedupeGroupKey("type", { b: 2, a: "1" });
    expect(key.hash).toBe(new DedupeGroupKey("type", { a: "1", b: 2 }).hash);
    expect(key.hash).not.toBe(
      new DedupeGroupKey("other", { a: "1", b: 2 }).hash,
    );
    expect(new DedupeGroupKey("type", { sbi: "123" }).hash).not.toBe(
      new DedupeGroupKey("type", { sbi: 123 }).hash,
    );
    expect(
      DedupeGroupKey.fromRoute("type", key.routeKey, ["a", "b"]).values,
    ).toEqual(key.values);
    expect(() =>
      DedupeGroupKey.fromRoute("type", key.routeKey, ["sbi"]),
    ).toThrow();
    expect(() =>
      DedupeGroupKey.fromRoute("type", "invalid", ["sbi"]),
    ).toThrow();
  });
  it("keeps immutable grouping/scope configurable and rejects the old label DSL", () => {
    expect(compileDedupe(config).groupBy).toHaveLength(1);
    expect(() =>
      compileDedupe({ ...config, labels: { options: [] } }),
    ).toThrow();
    expect(() =>
      compileDedupe({
        ...config,
        groupBy: [...config.groupBy, ...config.groupBy],
      }),
    ).toThrow();
    expect(() =>
      compileDedupe({ ...config, groupBy: [{ value: "$case.currentStatus" }] }),
    ).toThrow();
    expect(() =>
      compileDedupe({
        ...config,
        groupBy: [{ value: "$case.payload.__proto__.value" }],
      }),
    ).toThrow();
  });
});
