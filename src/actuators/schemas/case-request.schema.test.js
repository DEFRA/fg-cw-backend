import { describe, expect, it } from "vitest";
import {
  caseDataQuery,
  caseKeyParams,
  caseSearchPayload,
} from "./case-request.schema.js";

describe("caseSearchPayload", () => {
  it("accepts every field together but a cursor with a ref", () => {
    expect(
      caseSearchPayload.validate({
        workflowCode: "frps",
        from: "2026-06-01T00:00:00.000Z",
        to: "2026-06-30T00:00:00.000Z",
        cursor: "eyJ9",
        withTotal: false,
      }).error,
    ).toBeUndefined();
  });

  it("lowercases and trims the ref", () => {
    expect(caseSearchPayload.validate({ ref: " ABC-1 " }).value).toEqual({
      ref: "abc-1",
    });
  });

  it("treats a blank ref and workflow as absent", () => {
    expect(
      caseSearchPayload.validate({ ref: "", workflowCode: "" }).value,
    ).toEqual({});
  });

  it("compares the bounds as instants", () => {
    expect(
      caseSearchPayload.validate({
        from: "2026-06-16T01:00:00+02:00",
        to: "2026-06-16T00:00:00Z",
      }).error,
    ).toBeUndefined();
  });

  it.each([
    ["a ref with a cursor", { ref: "a", cursor: "c" }],
    [
      "from after to",
      { from: "2026-06-17T00:00:00Z", to: "2026-06-16T00:00:00Z" },
    ],
    ["an unknown field", { sbi: "123456789" }],
    ["a ref over 128 characters", { ref: "a".repeat(129) }],
  ])("refuses %s", (_name, payload) => {
    expect(caseSearchPayload.validate(payload).error).toBeDefined();
  });
});

describe("caseKeyParams", () => {
  it("requires both parts of the key", () => {
    expect(
      caseKeyParams.validate({ workflowCode: "frps", caseRef: "ref-1" }).error,
    ).toBeUndefined();
    expect(
      caseKeyParams.validate({ workflowCode: "frps" }).error,
    ).toBeDefined();
  });
});

describe("caseDataQuery", () => {
  it("takes only document as an include", () => {
    expect(caseDataQuery.validate({}).error).toBeUndefined();
    expect(
      caseDataQuery.validate({ include: "document" }).error,
    ).toBeUndefined();
    expect(caseDataQuery.validate({ include: "payload" }).error).toBeDefined();
  });
});
