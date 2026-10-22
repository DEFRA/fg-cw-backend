import { describe, expect, it } from "vitest";
import { notFoundWithReason } from "./not-found-with-reason.js";

describe("notFoundWithReason", () => {
  it("answers 404 with the message and the reason", () => {
    const { output } = notFoundWithReason("Case not found", "CASE_NOT_FOUND");

    expect(output.statusCode).toBe(404);
    expect(output.payload).toEqual({
      statusCode: 404,
      error: "Not Found",
      message: "Case not found",
      reason: "CASE_NOT_FOUND",
    });
  });
});
