import { describe, expect, it } from "vitest";
import { parseSemver } from "./semver.js";

describe("parseSemver", () => {
  it("should parse valid semver strings", () => {
    expect(parseSemver("1.2.3")).toEqual({ major: 1, minor: 2, patch: 3 });
    expect(parseSemver("0.0.0")).toEqual({ major: 0, minor: 0, patch: 0 });
    expect(parseSemver("10.20.30")).toEqual({
      major: 10,
      minor: 20,
      patch: 30,
    });
  });

  it("should return null for invalid formats", () => {
    expect(parseSemver("1.2")).toBeNull();
    expect(parseSemver("1.2.3.4")).toBeNull();
    expect(parseSemver("abc")).toBeNull();
    expect(parseSemver("1.2.x")).toBeNull();
    expect(parseSemver("")).toBeNull();
  });
});
