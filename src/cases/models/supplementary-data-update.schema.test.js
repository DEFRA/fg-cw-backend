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
  it("rejects NUL in an OBJECT identity", () => {
    expect(
      updateCaseSupplementaryDataSchema.validate(
        event({ dataType: "OBJECT", data: { id: "bad\0identity" } }),
      ).error,
    ).toBeDefined();
  });
  it("keeps NUL valid in an ARRAY identity", () => {
    const value = event({ dataType: "ARRAY", data: { id: "literal\0value" } });
    const result = updateCaseSupplementaryDataSchema.validate(value);

    expect(result.error).toBeUndefined();
    expect(result.value).toEqual(value);
  });
  it.each(["a.b", "$value", "__proto__", 0])(
    "accepts literal OBJECT identity %j",
    (id) => {
      const value = event({ dataType: "OBJECT", data: { id } });
      const result = updateCaseSupplementaryDataSchema.validate(value);

      expect(result.error).toBeUndefined();
      expect(result.value).toEqual(value);
    },
  );
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
