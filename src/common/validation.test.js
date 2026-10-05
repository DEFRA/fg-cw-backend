import Joi from "joi";
import { describe, expect, it, vi } from "vitest";
import { logger } from "./logger.js";
import { safeFailAction, safeResponseFailAction } from "./validation.js";

vi.mock("./logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const failureOf = (value) =>
  Joi.object({ ref: Joi.string().pattern(/^[a-z]+$/) }).validate(value, {
    abortEarly: false,
  }).error;

const SECRET = "SECRET-VALUE-123";

describe("safeFailAction", () => {
  it("throws a 400 with a fixed message", () => {
    expect(() => safeFailAction({}, {}, failureOf({ ref: SECRET }))).toThrow(
      expect.objectContaining({
        message: "Invalid request",
        output: expect.objectContaining({ statusCode: 400 }),
      }),
    );
  });

  it("logs each failing path and rule, never the value", () => {
    expect(() => safeFailAction({}, {}, failureOf({ ref: SECRET }))).toThrow();

    expect(logger.warn).toHaveBeenCalledWith(
      "Request failed validation: ref:string.pattern.base",
    );
    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain(SECRET);
  });
});

describe("safeResponseFailAction", () => {
  it("throws a 500 and logs only the path and rule", () => {
    expect(() =>
      safeResponseFailAction({}, {}, failureOf({ ref: SECRET })),
    ).toThrow(
      expect.objectContaining({
        output: expect.objectContaining({ statusCode: 500 }),
      }),
    );

    expect(logger.error).toHaveBeenCalledWith(
      "Response failed validation: ref:string.pattern.base",
    );
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain(SECRET);
  });
});
