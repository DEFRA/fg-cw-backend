import { describe, expect, it } from "vitest";
import { STORED, indexKeysOf } from "../../common/buckets/bucket.js";
import { choosePlan } from "../../common/buckets/plan.js";
import { casesBucket } from "./cases.bucket.js";

describe("cw.cases", () => {
  const bucket = casesBucket();

  it("lists cases by the time they were created, and audits being read", () => {
    expect(bucket).toMatchObject({
      id: "cw.cases",
      path: "cases",
      label: "Cases",
      service: "CW",
      shortLabel: "Cases",
      icon: "folder",
      order: 80,
      noun: { one: "case", many: "cases" },
      collection: "cases",
      time: { field: "createdAt", type: "date", label: "Created" },
      audited: true,
      timeline: false,
    });
  });

  it("reads its workflows from the stored rows, and declares no other fact to filter by", () => {
    expect(bucket.facts).toEqual({
      workflowCode: {
        label: "Workflow",
        values: STORED,
        toggle: null,
        param: "workflow",
      },
    });
  });

  it("declares its ref kinds", () => {
    expect(bucket.refs).toEqual({ ref: "Reference", sbi: "SBI" });
  });

  it("declares the index keys of its lines", () => {
    expect(indexKeysOf(bucket).map(Object.keys)).toEqual([
      ["createdAt", "_id"],
      ["workflowCode", "createdAt", "_id"],
      ["refs", "createdAt", "_id"],
    ]);
  });

  it("reads a workflow exactly", () => {
    expect(choosePlan(bucket, ["workflowCode"], false)).toEqual({
      kind: "exact",
      line: ["workflowCode"],
      filled: [],
      residual: [],
    });
  });

  it("groups by nothing, so its workflows are a menu, and draws the status in the position", () => {
    expect(bucket.groupings).toEqual([]);
    expect(bucket.title).toEqual({ label: "Reference", format: "mono" });
    expect(bucket.columns).toEqual([
      { key: "workflowCode", label: "Workflow", format: "mono" },
      { key: "position", label: "Status", format: "position" },
    ]);
  });

  it("never projects the payload, the task tree or supplementary data", () => {
    expect(bucket.row.projection).toEqual({
      caseRef: 1,
      workflowCode: 1,
      currentPhase: 1,
      currentStage: 1,
      currentStatus: 1,
    });
  });

  it("presents a row linked to its case page", () => {
    expect(
      bucket.row.present({
        caseRef: "abc-123",
        workflowCode: "example-workflow",
        currentPhase: "PRE_AWARD",
        currentStage: "REVIEW",
        currentStatus: "IN_REVIEW",
        closedAt: new Date("2026-10-09T09:14:04.000Z"),
      }),
    ).toEqual({
      title: "abc-123",
      subtitle: null,
      cells: {
        workflowCode: "example-workflow",
        position: { phase: "PRE_AWARD", stage: "REVIEW", status: "IN_REVIEW" },
      },
      link: {
        kind: "case",
        workflowCode: "example-workflow",
        caseRef: "abc-123",
      },
    });
  });

  it("presents null for what an open case with no position does not hold", () => {
    expect(
      bucket.row.present({ caseRef: "abc-123", workflowCode: "w" }).cells,
    ).toEqual({
      workflowCode: "w",
      position: { phase: null, stage: null, status: null },
    });
  });
});
