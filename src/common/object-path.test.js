import { describe, expect, it } from "vitest";
import { path, setObjectPath } from "./object-path.js";

describe("path", () => {
  it("should return false if path does not exist", () => {
    const obj = {};
    expect(path(obj, "foo", "bar")).toBeFalsy();

    const obj2 = {
      foo: {},
    };
    expect(path(obj2, "foo", "bar")).toBeFalsy();
  });

  it("should return true if path exists", () => {
    const obj = { foo: { bar: {} } };
    expect(path(obj, "foo", "bar")).toBeTruthy();
  });
});

describe("setObjectPath", () => {
  it("should recursively set an object path", () => {
    const obj = {};
    setObjectPath(obj, "foo", "path1", "path2");
    expect(obj.path1.path2).toBe("foo");
  });

  it("should not overwrite existing properties", () => {
    const obj = {
      path1: {
        existingValue: true,
      },
    };
    setObjectPath(obj, "foo", "path1", "path2");
    expect(obj.path1.path2).toBe("foo");
    expect(obj.path1.existingValue).toBe(true);
  });
});
