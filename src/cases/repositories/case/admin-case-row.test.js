import { Decimal128, Long, ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";
import {
  byNewestFirst,
  hasMembers,
  toCaseListRow,
  toCaseRow,
  toCaseSummary,
  toStoredDocument,
} from "./admin-case-row.js";

describe("toCaseRow", () => {
  it("maps the stored top-level fields", () => {
    expect(
      toCaseRow({
        _id: new ObjectId(),
        caseRef: "ref-1",
        workflowCode: "frps",
        currentPhase: "P",
        currentStage: "S",
        currentStatus: "T",
        closed: true,
        closedAt: new Date("2026-06-20T00:00:00Z"),
        createdAt: new Date("2026-06-16T00:00:00Z"),
      }),
    ).toEqual({
      ref: { caseRef: "ref-1", workflowCode: "frps" },
      position: { phase: "P", stage: "S", status: "T" },
      closed: true,
      closedAt: "2026-06-20T00:00:00.000Z",
      createdAt: "2026-06-16T00:00:00.000Z",
    });
  });

  it("gives null for each field a legacy document lacks", () => {
    expect(toCaseRow({ _id: new ObjectId() })).toEqual({
      ref: { caseRef: null, workflowCode: null },
      position: { phase: null, stage: null, status: null },
      closed: null,
      closedAt: null,
      createdAt: null,
    });
  });
});

describe("toCaseListRow", () => {
  const SERIES = [
    {
      workflowCode: "frps",
      caseRefs: ["ref-1", "ref-2"],
      latestCaseRef: "ref-2",
    },
  ];

  it.each([
    ["an older member", { caseRef: "ref-1", workflowCode: "frps" }, true],
    ["the latest member", { caseRef: "ref-2", workflowCode: "frps" }, false],
    [
      "the same ref under another workflow",
      { caseRef: "ref-1", workflowCode: "woodland" },
      false,
    ],
    ["a case in no series", { caseRef: "loner", workflowCode: "frps" }, false],
    ["a legacy row with no ref", {}, false],
  ])("marks %s replaced: %s", (_name, doc, replaced) => {
    expect(toCaseListRow(doc, SERIES).replaced).toBe(replaced);
  });

  it("is the row with the flag added", () => {
    const doc = { caseRef: "ref-1", workflowCode: "frps" };

    expect(toCaseListRow(doc, [])).toEqual({
      ...toCaseRow(doc),
      replaced: false,
    });
  });
});

describe("hasMembers", () => {
  it.each([
    [undefined, false],
    [{ caseRefs: ["ref-1"] }, false],
    [{ caseRefs: ["ref-1", "ref-2"] }, true],
  ])("for %j is %s", (series, expected) => {
    expect(hasMembers(series)).toBe(expected);
  });
});

describe("toCaseSummary", () => {
  it("falls back to the legacy configVersion for both versions", () => {
    expect(
      toCaseSummary(
        { caseRef: "ref-1", configVersion: "0.0.0" },
        undefined,
        [],
      ),
    ).toMatchObject({
      originalConfigVersion: "0.0.0",
      currentConfigVersion: "0.0.0",
      series: null,
    });
  });

  it("maps the series with its members oldest first, in the series' order", () => {
    expect(
      toCaseSummary(
        { caseRef: "ref-1" },
        { caseRefs: ["ref-0", "ref-1"], latestCaseRef: "ref-1" },
        [
          {
            caseRef: "ref-1",
            currentPhase: "P",
            currentStage: "S",
            currentStatus: "T",
            createdAt: new Date("2026-06-16T00:00:00Z"),
            closedAt: null,
          },
          {
            caseRef: "ref-0",
            currentPhase: "P",
            currentStage: "S",
            currentStatus: "DONE",
            createdAt: new Date("2026-06-01T00:00:00Z"),
            closedAt: new Date("2026-06-10T00:00:00Z"),
          },
        ],
      ).series,
    ).toEqual({
      latestRef: "ref-1",
      refs: ["ref-0", "ref-1"],
      members: [
        {
          caseRef: "ref-0",
          position: { phase: "P", stage: "S", status: "DONE" },
          createdAt: "2026-06-01T00:00:00.000Z",
          closedAt: "2026-06-10T00:00:00.000Z",
        },
        {
          caseRef: "ref-1",
          position: { phase: "P", stage: "S", status: "T" },
          createdAt: "2026-06-16T00:00:00.000Z",
          closedAt: null,
        },
      ],
    });
  });

  it("gives a series of one no members", () => {
    expect(
      toCaseSummary(
        { caseRef: "ref-1" },
        { caseRefs: ["ref-1"], latestCaseRef: "ref-1" },
        [],
      ).series,
    ).toEqual({ latestRef: "ref-1", refs: ["ref-1"], members: [] });
  });

  it("gives a member's dates as the row does", () => {
    const [member] = toCaseSummary(
      { caseRef: "ref-1" },
      { caseRefs: ["ref-0", "ref-1"], latestCaseRef: "ref-1" },
      [{ caseRef: "ref-0", createdAt: "not a date" }],
    ).series.members;

    expect(member.createdAt).toBe(
      toCaseRow({ createdAt: "not a date" }).createdAt,
    );
  });
});

describe("toStoredDocument", () => {
  it("is the stored document without the computed size", () => {
    const doc = { _id: new ObjectId(), caseRef: "ref-1", storedBytes: 10 };

    expect(toStoredDocument(doc)).toEqual({ _id: doc._id, caseRef: "ref-1" });
  });

  it("gives BSON numbers anywhere in the blobs as plain JSON", () => {
    expect(
      toStoredDocument({
        payload: { a: Long.fromNumber(5), b: [Decimal128.fromString("1.5")] },
      }),
    ).toEqual({ payload: { a: 5, b: ["1.5"] } });
  });

  it("returns two differently shaped payloads unchanged", () => {
    const wmp = { answers: { parcels: [{ id: "SX1", ha: 2.5 }] } };
    const frps = { applicant: { business: { name: "x" } }, actions: [] };

    expect(toStoredDocument({ payload: wmp }).payload).toEqual(wmp);
    expect(toStoredDocument({ payload: frps }).payload).toEqual(frps);
  });
});

describe("byNewestFirst", () => {
  it("orders by createdAt descending, then _id descending", () => {
    const a = {
      createdAt: new Date(1),
      _id: new ObjectId("000000000000000000000002"),
    };
    const b = {
      createdAt: new Date(2),
      _id: new ObjectId("000000000000000000000001"),
    };
    const c = {
      createdAt: new Date(1),
      _id: new ObjectId("000000000000000000000003"),
    };

    expect([a, b, c].sort(byNewestFirst)).toEqual([b, c, a]);
  });

  it("puts a null, string or missing createdAt last, still by _id", () => {
    const dated = {
      createdAt: new Date(1),
      _id: new ObjectId("000000000000000000000001"),
    };
    const nulled = {
      createdAt: null,
      _id: new ObjectId("000000000000000000000002"),
    };
    const string = {
      createdAt: "2026-06-16T00:00:00.000Z",
      _id: new ObjectId("000000000000000000000003"),
    };
    const missing = { _id: new ObjectId("000000000000000000000004") };

    expect([nulled, dated, missing, string].sort(byNewestFirst)).toEqual([
      dated,
      missing,
      string,
      nulled,
    ]);
  });

  it("breaks a tie on an _id that is not an ObjectId", () => {
    const createdAt = new Date(1);
    const legacy = { createdAt, _id: "legacy-1" };
    const stringId = { createdAt, _id: "legacy-2" };
    const objectId = {
      createdAt,
      _id: new ObjectId("000000000000000000000001"),
    };

    expect([objectId, legacy, stringId].sort(byNewestFirst)).toEqual([
      stringId,
      legacy,
      objectId,
    ]);
  });
});
