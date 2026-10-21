import { describe, expect, it } from "vitest";
import { CaseDocument, caseRefs, seriesRefs } from "./case-document.js";

describe("caseRefs", () => {
  it("refs the case reference and the SBI, lower-cased", () => {
    expect(
      caseRefs({
        caseRef: " ABC-123 ",
        payload: { identifiers: { sbi: 100000001 } },
      }),
    ).toEqual(["ref:abc-123", "sbi:100000001"]);
  });

  it.each([
    ["no payload", {}],
    ["no identifiers", { payload: {} }],
    ["no SBI", { payload: { identifiers: {} } }],
    ["a null payload", { payload: null }],
  ])("refs only the reference for a case with %s", (_, props) => {
    expect(caseRefs({ caseRef: "abc-123", ...props })).toEqual(["ref:abc-123"]);
  });

  it("answers no refs for a case with no reference", () => {
    expect(caseRefs({})).toEqual([]);
  });
});

describe("seriesRefs", () => {
  it("refs every member once", () => {
    expect(seriesRefs(["ABC-1", "abc-2", "abc-1"])).toEqual([
      "ref:abc-1",
      "ref:abc-2",
    ]);
  });
});

describe("CaseDocument", () => {
  it("carries its own refs", () => {
    const document = CaseDocument.createMock({
      caseRef: "ABC-123",
      payload: { identifiers: { sbi: "100000001" } },
    });

    expect(document.refs).toEqual(["ref:abc-123", "sbi:100000001"]);
  });

  it("holds no replaced flag, so a save cannot write a stale one", () => {
    expect(CaseDocument.createMock()).not.toHaveProperty("replaced");
  });
});
