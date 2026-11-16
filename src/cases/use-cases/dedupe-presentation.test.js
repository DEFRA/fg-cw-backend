import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { DedupeGroup } from "../models/dedupe-group.js";
import { DedupeGroupKey } from "../models/dedupe-group-key.js";
import { Workflow } from "../models/workflow.js";
import { compileDedupe } from "../schemas/dedupe-definition.js";
import {
  presentConfiguredColumns,
  presentConfiguredData,
  sortConfiguredRows,
} from "./dedupe-presentation.js";

const tab = JSON.parse(
  await readFile(
    new URL("../../../test/fixtures/dedupe-page.json", import.meta.url),
  ),
);
const definition = JSON.parse(
  await readFile(
    new URL(
      "../../../test/fixtures/frps-workflow-definition.json",
      import.meta.url,
    ),
  ),
);
const fixture = () => structuredClone(tab["page-type"].configuration);
const cases = [
  {
    caseRef: "a",
    currentStatus: "ACTIVE",
    source: { s0: "Oldest farm" },
    labels: [{ namespace: "duplicates", code: "NOT_DUPLICATE" }],
  },
  {
    caseRef: "b",
    currentStatus: "ACTIVE",
    source: { s0: "Newer farm" },
    labels: [],
  },
  {
    caseRef: "x",
    currentStatus: "REJECTED",
    source: { s0: "Excluded farm" },
    labels: [
      {
        namespace: "duplicates",
        code: "DUPLICATE",
        data: { duplicateOf: "a" },
      },
    ],
  },
];
const group = () =>
  new DedupeGroup(
    new DedupeGroupKey("type", { sbi: "123" }),
    structuredClone(cases),
    ["REJECTED"],
  );

describe("configured dedupe presentation", () => {
  it("uses all five ticket functions and supports explicit all/active/excluded collections", () => {
    const config = fixture();
    config.data.details.allDuplicates =
      "function:labelCount(@.cases, 'DUPLICATE')";
    const { plan } = compileDedupe(config);
    const data = presentConfiguredData(group(), { assignee: null }, plan);
    expect(data.details).toEqual({
      sbi: "123",
      businessName: "Oldest farm",
      applicationsCount: 3,
      excludedCount: 1,
      notSet: 1,
      notDuplicate: 1,
      duplicate: 0,
      allDuplicates: 1,
    });
    expect(data.status.tag).toBe("IN_PROGRESS");
    expect(data.assignee.name).toBe("Not set");
    const columns = presentConfiguredColumns(data, "/groups/safe-key", plan);
    expect(columns.details[0]).toEqual({
      component: "url",
      text: "SBI 123: Oldest farm",
      href: "/groups/safe-key",
    });
    expect(columns.status[0]).toMatchObject({
      component: "status",
      text: "IN_PROGRESS",
      labelsMap: { IN_PROGRESS: "In progress" },
      classesMap: { IN_PROGRESS: "govuk-tag--light-blue" },
    });
    expect(plan.sourcePaths).toEqual([
      { slot: "s0", path: "payload.answers.applicant.business.name" },
    ]);
  });
  it("shares completion policy with the domain and treats missing optional sources explicitly", () => {
    const { plan } = compileDedupe(fixture());
    const review = group();
    review.cases[0].source = {};
    expect(
      presentConfiguredData(review, { assignee: null }, plan).details
        .businessName,
    ).toBeNull();
    expect(
      presentConfiguredColumns(
        presentConfiguredData(review, { assignee: null }, plan),
        "/group",
        plan,
      ).details[0].text,
    ).toBe("SBI 123: ");
    for (const member of review.activeCases)
      member.labels = [{ namespace: "duplicates", code: "NOT_DUPLICATE" }];
    expect(
      presentConfiguredData(review, { assignee: { name: "Alex" } }, plan).status
        .tag,
    ).toBe(review.status);
    expect(review.status).toBe("COMPLETED");
    review.cases[0].source.s0 = { unexpected: "object" };
    expect(() =>
      presentConfiguredData(review, { assignee: null }, plan),
    ).toThrow(/scalar/);
  });
  it("sorts typed values with null last in either direction and deterministic ties", () => {
    const rows = [
      { details: { sbi: null }, keyHash: "z" },
      { details: { sbi: 10 }, keyHash: "b" },
      { details: { sbi: 2 }, keyHash: "a" },
      { details: { sbi: "2" }, keyHash: "c" },
      { details: { sbi: 2 }, keyHash: "0" },
    ];
    const { plan } = compileDedupe(fixture());
    plan.sort[0].order = "ascending";
    expect(sortConfiguredRows([...rows], plan).map((r) => r.keyHash)).toEqual([
      "0",
      "a",
      "b",
      "c",
      "z",
    ]);
    plan.sort[0].order = "descending";
    expect(sortConfiguredRows([...rows], plan).map((r) => r.keyHash)).toEqual([
      "c",
      "b",
      "0",
      "a",
      "z",
    ]);
  });
  it.each([
    [
      "unknown function",
      (c) => {
        c.data.details.businessName = "function:unknown(@.cases)";
      },
      "data.details.businessName",
    ],
    [
      "arity",
      (c) => {
        c.data.details.businessName = "function:first(@.cases)";
      },
      "data.details.businessName",
    ],
    [
      "collection",
      (c) => {
        c.data.details.notSet = "function:unlabelledCount(@.everyone)";
      },
      "data.details.notSet",
    ],
    [
      "completion policy",
      (c) => {
        c.data.status.tag = "function:groupStatus(@.cases)";
      },
      "data.status.tag",
    ],
    [
      "label policy",
      (c) => {
        c.data.details.duplicate = "function:labelCount(@.cases, 'CUSTOM')";
      },
      "data.details.duplicate",
    ],
    [
      "source path",
      (c) => {
        c.data.details.businessName =
          "function:first(@.cases, '$case.payload.__proto__.value')";
      },
      "data.details.businessName",
    ],
    [
      "cross-data dependency",
      (c) => {
        c.data.details.businessName = "@.details.sbi";
      },
      "data.details.businessName",
    ],
    [
      "unknown column reference",
      (c) => {
        c.columns.details[0].text = "@.unknown";
      },
      "columns.details[0].text",
    ],
    [
      "map expression",
      (c) => {
        c.columns.status[0].labelsMap.COMPLETED = "@.unknown";
      },
      "columns.status[0].labelsMap",
    ],
    [
      "sort path",
      (c) => {
        c.sort[0].value = "@.details.unknown";
      },
      "sort[0].value",
    ],
    [
      "sort direction",
      (c) => {
        c.sort[0].order = "sideways";
      },
      "sort[0].order",
    ],
    [
      "unknown column",
      (c) => {
        c.columns.extra = c.columns.details;
      },
      "columns.extra",
    ],
    [
      "missing column",
      (c) => {
        delete c.columns.status;
      },
      "columns.status",
    ],
    [
      "missing header source",
      (c) => {
        delete c.data.details.businessName;
      },
      "data.details.businessName",
    ],
    [
      "reserved name",
      (c) => {
        c.data.details.groupHref = "spoof";
      },
      "data.details.groupHref",
    ],
    [
      "arbitrary URL",
      (c) => {
        c.columns.details[0].href = "javascript:bad";
      },
      "columns.details[0].href",
    ],
    [
      "unsupported header label",
      (c) => {
        c.columns.assignee[0].label = "Who";
      },
      "columns.assignee[0].label",
    ],
  ])(
    "rejects %s at workflow load with its field location",
    (_name, mutate, location) => {
      const config = fixture();
      mutate(config);
      const workflow = structuredClone(definition);
      workflow.pages["case-list"] = {
        tabs: {
          duplicates: {
            ...tab,
            "page-type": { type: "dedupe", configuration: config },
          },
        },
      };
      expect(() => Workflow.fromDefinition(workflow, "1.0.0")).toThrow(
        location,
      );
    },
  );
});
