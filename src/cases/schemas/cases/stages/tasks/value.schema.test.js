import { describe, expect, it } from "vitest";
import { valueSchema } from "./value.schema.js";

describe("valueSchema", () => {
  it("allows valid task values", () => {
    expect(valueSchema.validate("RFI").error).toBeUndefined();
    expect(valueSchema.validate("ACCEPTED").error).toBeUndefined();
    expect(valueSchema.validate(null).error).toBeUndefined();
  });

  it("does not allow others", () => {
    const { error } = valueSchema.validate(999);
    expect(error.name).toEqual("ValidationError");
  });
});
