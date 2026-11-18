import { describe, expect, it } from "vitest";
import { count, first } from "./collections.js";

describe("collection operations", () => {
  it("counts empty and arbitrary collections without knowing their contents", () => {
    expect(count([])).toBe(0);
    expect(count([false, 0, "", { anything: true }])).toBe(4);
  });
  it("returns the first item without treating falsy values as missing", () => {
    expect(first([])).toBeNull();
    for (const value of [false, 0, ""])
      expect(first([value, "later"])).toBe(value);
  });
});
