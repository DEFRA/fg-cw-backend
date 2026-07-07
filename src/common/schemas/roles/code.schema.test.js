import { describe, expect, it } from "vitest";
import { codeSchema } from "./code.schema.js";

describe("codeSchema", () => {
  it.each([
    {
      description: "accepts a valid role code",
      code: "RPA_ADMIN",
      expectedError: false,
    },
    {
      description: "rejects role code starting with underscore",
      code: "_RPA_ADMIN",
      expectedError: true,
      errorMessage:
        '"value" with value "_RPA_ADMIN" fails to match the required pattern',
    },
    {
      description: "accepts role code with underscore not at the start",
      code: "ROLE_RPA_ADMIN",
      expectedError: false,
    },
    {
      description: "accepts role code starting with a number",
      code: "1ST_LINE_SUPPORT",
      expectedError: false,
    },
    {
      description:
        "rejects role code starting with a number when it contains invalid characters",
      code: "1ST-LINE-SUPPORT",
      expectedError: true,
      errorMessage:
        '"value" with value "1ST-LINE-SUPPORT" fails to match the required pattern',
    },
  ])("$description", ({ code, expectedError, errorMessage }) => {
    const { error, value } = codeSchema.validate(code);

    if (expectedError) {
      expect(error).toBeDefined();
      expect(error.details[0].message).toContain(errorMessage);
    } else {
      expect(error).toBeUndefined();
      expect(value).toBe(code);
    }
  });
});
