import { describe, expect, it } from "vitest";
import { updateCaseSupplementaryDataSchema } from "./supplementary-data-update.schema.js";
const event = (supplementaryData = {}) => ({
  caseRef: "case-1",
  workflowCode: "example",
  supplementaryData: {
    targetNode: "results",
    dataType: "ARRAY",
    key: "id",
    data: {
      id: "one",
      anything: { amount: -123, status: "any value", extra: [true, null, 1] },
    },
    ...supplementaryData,
  },
});
describe("supplementary data update envelope", () => {
  it.each(["ARRAY", "OBJECT"])("accepts opaque %s data", (dataType) => {
    const value = event({ dataType });
    const result = updateCaseSupplementaryDataSchema.validate(value);
    expect(result.error).toBeUndefined();
    expect(result.value).toEqual(value);
  });
  it("accepts a zero numeric merge key", () => {
    expect(
      updateCaseSupplementaryDataSchema.validate(event({ data: { id: 0 } }))
        .error,
    ).toBeUndefined();
  });
  it.each([
    "bad.path",
    "$bad",
    "__proto__",
    "constructor",
    "prototype",
    "toString",
    "bad\0node",
    "",
  ])("rejects unsafe target node %j", (targetNode) => {
    expect(
      updateCaseSupplementaryDataSchema.validate(event({ targetNode })).error,
    ).toBeDefined();
  });
  it.each([
    { dataType: "UNKNOWN" },
    { key: "missing" },
    { data: { id: {} } },
    { data: { id: null } },
    { data: {} },
    { data: [] },
    { data: null },
  ])("rejects invalid merge instructions %j", (fields) => {
    expect(
      updateCaseSupplementaryDataSchema.validate(event(fields)).error,
    ).toBeDefined();
  });
  it.each([
    undefined,
    null,
    {},
    { ...event(), caseRef: "" },
    { ...event(), newStatus: "A:B:C" },
  ])("rejects invalid envelope %j", (value) => {
    expect(
      updateCaseSupplementaryDataSchema.validate(value).error,
    ).toBeDefined();
  });
});
