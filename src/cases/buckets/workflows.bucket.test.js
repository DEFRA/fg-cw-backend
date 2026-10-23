import { describe, expect, it } from "vitest";
import { STORED, indexKeysOf } from "../../common/buckets/bucket.js";
import { choosePlan } from "../../common/buckets/plan.js";
import { workflowsBucket } from "./workflows.bucket.js";

const DEFINITION_VALUES = [
  {
    value: "fetched",
    label: "Stored",
    tone: "success",
    hint: "CW has loaded this version's workflow definition.",
  },
  {
    value: "pending",
    label: "Not stored yet",
    tone: "neutral",
    hint: "This version's workflow definition isn't fetched by CW yet. CW fetches it from S3 when it first needs it, and only uses the newest usable Active version in each major, so an older version may never be fetched; that is normal. A workflow definition stored with Fetch definition shows here until CW loads it itself.",
  },
  {
    value: "transient_error",
    label: "Fetch error",
    tone: "warning",
    hint: "CW's last fetch of this version's workflow definition from S3 failed. CW tries again the next time it needs it; after 5 failed fetches it stops trying and marks it Failed the next time it needs this version. Open the version for the error.",
  },
  {
    value: "permanent_error",
    label: "Failed",
    tone: "error",
    hint: "CW couldn't fetch or read this version's workflow definition, or stopped after 5 failed fetches, and won't use it. Open the version to see why and what it affects; publish a fixed version.",
  },
];

const FACTS = ["grantCode", "status", "fetchStatus"];

const subsetsOf = (names) =>
  names.reduce(
    (subsets, name) => [
      ...subsets,
      ...subsets.map((subset) => [...subset, name]),
    ],
    [[]],
  );

describe("cw.workflows", () => {
  const bucket = workflowsBucket();

  it("lists every workflow version by the time it was received, unaudited", () => {
    expect(bucket).toMatchObject({
      id: "cw.workflows",
      path: "workflows",
      label: "Workflows",
      service: "CW",
      shortLabel: "Workflows",
      icon: "workflow",
      order: 85,
      noun: { one: "workflow version", many: "workflow versions" },
      collection: "config_versions",
      time: { field: "receivedAt", type: "isoString", label: "Received" },
      audited: false,
      timeline: false,
    });
  });

  it("reads its workflows from the stored rows, and declares the statuses and fetch statuses", () => {
    expect(bucket.facts).toEqual({
      grantCode: {
        label: "Workflow",
        param: "workflow",
        values: STORED,
        toggle: null,
        within: null,
      },
      status: {
        label: "Status",
        param: "status",
        values: [
          {
            value: "active",
            label: "Active",
            tone: "success",
            hint: "Published by the config broker.",
          },
          {
            value: "draft",
            label: "Draft",
            tone: "neutral",
            hint: "Not yet published as active.",
          },
        ],
        toggle: null,
        within: null,
      },
      fetchStatus: {
        label: "Definition",
        param: "definition",
        values: DEFINITION_VALUES,
        toggle: null,
        within: null,
      },
    });
  });

  it("offers no search", () => {
    expect(bucket.refs).toEqual({});
  });

  it("declares the index keys of its lines", () => {
    expect(indexKeysOf(bucket).map(Object.keys)).toEqual([
      ["receivedAt", "_id"],
      ["grantCode", "status", "fetchStatus", "receivedAt", "_id"],
      ["status", "fetchStatus", "receivedAt", "_id"],
      ["refs", "receivedAt", "_id"],
    ]);
  });

  it.each(
    subsetsOf(FACTS).map((asked) => [asked.join(", ") || "nothing", asked]),
  )("reads %s exactly", (_name, asked) => {
    expect(choosePlan(bucket, asked, false).kind).toBe("exact");
  });

  it("groups by nothing, so each fact is a menu, and draws definition and status as badges", () => {
    expect(bucket.groupings).toEqual([]);
    expect(bucket.title).toEqual({ label: "Workflow", format: "mono" });
    expect(bucket.columns).toEqual([
      { key: "version", label: "Version", format: "mono" },
      {
        key: "definition",
        label: "Definition",
        format: "badge",
        fact: "fetchStatus",
      },
      { key: "status", label: "Status", format: "badge", fact: "status" },
    ]);
  });

  it("projects only what a row shows", () => {
    expect(bucket.row.projection).toEqual({
      grantCode: 1,
      version: 1,
      status: 1,
      fetchStatus: 1,
    });
  });

  it("presents an active fetched version linked to its version page", () => {
    expect(
      bucket.row.present({
        grantCode: "example-workflow",
        version: "1.2.0",
        status: "active",
        fetchStatus: "fetched",
      }),
    ).toEqual({
      title: "example-workflow",
      subtitle: null,
      cells: { version: "1.2.0", status: "active", definition: "fetched" },
      link: { kind: "workflow", code: "example-workflow", version: "1.2.0" },
    });
  });

  it("presents a draft whose fetch failed for good with its failed status", () => {
    expect(
      bucket.row.present({
        grantCode: "example-workflow",
        version: "2.0.0",
        status: "draft",
        fetchStatus: "permanent_error",
      }).cells,
    ).toEqual({
      version: "2.0.0",
      status: "draft",
      definition: "permanent_error",
    });
  });
});
