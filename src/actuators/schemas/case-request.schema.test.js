import { describe, expect, it } from "vitest";
import { caseDataQuery, caseKeyParams } from "./case-request.schema.js";

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
