import { describe, expect, it } from "vitest";
import { statusSchema } from "./status.schema.js";

describe("statusSchema", () => {
  it("allows valid task statuses", () => {
    expect(statusSchema.validate("RFI").error).toBeUndefined();
    expect(statusSchema.validate("ACCEPTED").error).toBeUndefined();
    expect(statusSchema.validate(null).error).toBeUndefined();
  });

  it("does not allow others", () => {
    const { error } = statusSchema.validate(999);
    expect(error.name).toEqual("ValidationError");
  });
});
