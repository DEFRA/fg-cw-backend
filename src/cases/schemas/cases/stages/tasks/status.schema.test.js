import { describe, expect, it } from "vitest";
import { statusSchema } from "./status.schema.js";

describe("statusSchema", () => {
  it("allows valid task statuses", () => {
    expect(statusSchema.validate("pending").error).toBeUndefined();
    expect(statusSchema.validate("in_progress").error).toBeUndefined();
    expect(statusSchema.validate("complete").error).toBeUndefined();
  });

  it("does not allow others", () => {
    const { error } = statusSchema.validate("invalid_status");
    expect(error.name).toEqual("ValidationError");
  });
});
