import { describe, expect, it } from "vitest";
import { isRetryableFailure, markPermanentFailure } from "./retryable.js";

describe("retryable", () => {
  it("treats an error that says nothing as retryable", () => {
    expect(isRetryableFailure(new Error("boom"))).toBe(true);
  });

  it("treats a missing error as retryable", () => {
    expect(isRetryableFailure(undefined)).toBe(true);
  });

  it("treats an error marked permanent as not retryable", () => {
    expect(isRetryableFailure(markPermanentFailure(new Error("bad")))).toBe(
      false,
    );
  });

  it("returns the same error, keeping its type and message", () => {
    const error = new TypeError("bad shape");

    const marked = markPermanentFailure(error);

    expect(marked).toBe(error);
    expect(marked).toBeInstanceOf(TypeError);
    expect(marked.message).toBe("bad shape");
  });
});
