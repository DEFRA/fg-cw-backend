import Boom from "@hapi/boom";
import { describe, expect, it, vi } from "vitest";
import { logger } from "./logger.js";
import { withErrorCode } from "./with-error-code.js";
import { loggedAction } from "./logged-action.js";

vi.mock("./logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn() },
}));

describe("loggedAction", () => {
  it("logs the action, then that it finished, and answers its result", async () => {
    expect(await loggedAction("Doing it", async () => 42)).toBe(42);
    expect(logger.info.mock.calls).toEqual([
      ["Doing it"],
      ["Finished: Doing it"],
    ]);
  });

  it("names a refusal by its code alone, never its message", async () => {
    const refusal = withErrorCode(Boom.conflict("quotes a secret"), "NOPE");

    await expect(
      loggedAction("Doing it", () => Promise.reject(refusal)),
    ).rejects.toBe(refusal);
    expect(logger.warn).toHaveBeenCalledWith("Refused: Doing it - NOPE");
    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain("secret");
  });

  it("calls any other failure a failure", async () => {
    await expect(
      loggedAction("Doing it", () => Promise.reject(new Error("down"))),
    ).rejects.toThrow("down");
    expect(logger.warn).toHaveBeenCalledWith("Refused: Doing it - failed");
  });
});
