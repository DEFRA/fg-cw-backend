import { describe, expect, it } from "vitest";
import { codeSchema } from "./code.schema.js";

describe("codeSchema", () => {
  it("accepts a valid role code", () => {
    const { error, value } = codeSchema.validate("RPA_ADMIN");

    expect(error).toBeUndefined();
    expect(value).toBe("RPA_ADMIN");
  });

  it("rejects role code starting with underscore", () => {
    const { error } = codeSchema.validate("_RPA_ADMIN");

    expect(error).toBeDefined();
    expect(error.details[0].message).toContain(
      '"value" with value "_RPA_ADMIN" fails to match the required pattern',
    );
  });

  it("accepts role code with underscore not at the start", () => {
    const { error, value } = codeSchema.validate("ROLE_RPA_ADMIN");

    expect(error).toBeUndefined();
    expect(value).toBe("ROLE_RPA_ADMIN");
  });

  it("accepts role code starting with a number", () => {
    const { error, value } = codeSchema.validate("1ST_LINE_SUPPORT");

    expect(error).toBeUndefined();
    expect(value).toBe("1ST_LINE_SUPPORT");
  });

  it("rejects role code starting with a number when it contains invalid characters", () => {
    const { error } = codeSchema.validate("1ST-LINE-SUPPORT");

    expect(error).toBeDefined();
    expect(error.details[0].message).toContain(
      '"value" with value "1ST-LINE-SUPPORT" fails to match the required pattern',
    );
  });
});
