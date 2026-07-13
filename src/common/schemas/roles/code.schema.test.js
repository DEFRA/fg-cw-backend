import { describe, expect, it } from "vitest";
import { codeSchema } from "./code.schema.js";

describe("codeSchema", () => {
  it.each([
    { code: "RPA_ADMIN", description: "a valid role code" },
    {
      code: "ROLE_RPA_ADMIN",
      description: "role code with underscore not at the start",
    },
    {
      code: "1ST_LINE_SUPPORT",
      description: "role code starting with a number",
    },
  ])("accepts $description", ({ code }) => {
    const { error, value } = codeSchema.validate(code);

    expect(error).toBeUndefined();
    expect(value).toBe(code);
  });

  it.each([
    {
      code: "_RPA_ADMIN",
      description: "role code starting with underscore",
      expectedError:
        '"value" with value "_RPA_ADMIN" fails to match the required pattern',
    },
    {
      code: "1ST-LINE-SUPPORT",
      description:
        "role code starting with a number when it contains invalid characters",
      expectedError:
        '"value" with value "1ST-LINE-SUPPORT" fails to match the required pattern',
    },
  ])("rejects $description", ({ code, expectedError }) => {
    const { error } = codeSchema.validate(code);

    expect(error).toBeDefined();
    expect(error.details[0].message).toContain(expectedError);
  });
});
