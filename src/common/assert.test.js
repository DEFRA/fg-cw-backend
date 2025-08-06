import { describe, expect, it } from "vitest";
import { assertInstanceOf, assertIsArrayOfInstances } from "./assert.js";

describe("assertInstanceOf", () => {
  it("returns the value when it is an instance of the specified class", () => {
    const instance = new TestClass("test");
    const result = assertInstanceOf(instance, TestClass);
    expect(result).toBe(instance);
  });

  it("returns the value when it is an instance of the specified class with custom name", () => {
    const instance = new TestClass("test");
    const result = assertInstanceOf(instance, TestClass, "TestClass");
    expect(result).toBe(instance);
  });

  it("throws bad request when value is not an instance of the specified class", () => {
    const instance = new AnotherClass("test");
    expect(() => assertInstanceOf(instance, TestClass)).toThrow(
      "Must provide a valid value object",
    );
  });

  it("throws bad request with custom name when value is not an instance", () => {
    const instance = new AnotherClass("test");
    expect(() => assertInstanceOf(instance, TestClass, "TestClass")).toThrow(
      "Must provide a valid TestClass object",
    );
  });

  it("throws bad request when value is null", () => {
    expect(() => assertInstanceOf(null, TestClass)).toThrow(
      "Must provide a valid value object",
    );
  });

  it("throws bad request when value is undefined", () => {
    expect(() => assertInstanceOf(undefined, TestClass)).toThrow(
      "Must provide a valid value object",
    );
  });
});

describe("assertIsArrayOfInstances", () => {
  it("returns the array when all items are instances of the specified class", () => {
    const instances = [new TestClass("test1"), new TestClass("test2")];
    const result = assertIsArrayOfInstances(instances, TestClass);
    expect(result).toBe(instances);
  });

  it("returns the array when all items are instances with custom name", () => {
    const instances = [new TestClass("test1"), new TestClass("test2")];
    const result = assertIsArrayOfInstances(instances, TestClass, "TestClass");
    expect(result).toBe(instances);
  });

  it("returns empty array when provided with empty array", () => {
    const result = assertIsArrayOfInstances([], TestClass);
    expect(result).toEqual([]);
  });

  it("throws bad request when value is not an array", () => {
    expect(() => assertIsArrayOfInstances("not an array", TestClass)).toThrow(
      "Expected an array of object",
    );
  });

  it("throws bad request with custom name when value is not an array", () => {
    expect(() =>
      assertIsArrayOfInstances("not an array", TestClass, "TestClass"),
    ).toThrow("Expected an array of TestClass");
  });

  it("throws bad request when value is null", () => {
    expect(() => assertIsArrayOfInstances(null, TestClass)).toThrow(
      "Expected an array of object",
    );
  });

  it("throws bad request when value is undefined", () => {
    expect(() => assertIsArrayOfInstances(undefined, TestClass)).toThrow(
      "Expected an array of object",
    );
  });

  it("throws bad request when an item is not an instance of the specified class", () => {
    const instances = [new TestClass("test1"), new AnotherClass("test2")];
    expect(() => assertIsArrayOfInstances(instances, TestClass)).toThrow(
      "Item at index 1 is not a valid object instance",
    );
  });

  it("throws bad request with custom name when an item is not an instance", () => {
    const instances = [new TestClass("test1"), new AnotherClass("test2")];
    expect(() =>
      assertIsArrayOfInstances(instances, TestClass, "TestClass"),
    ).toThrow("Item at index 1 is not a valid TestClass instance");
  });

  it("throws bad request when first item is not an instance", () => {
    const instances = [new AnotherClass("test1"), new TestClass("test2")];
    expect(() => assertIsArrayOfInstances(instances, TestClass)).toThrow(
      "Item at index 0 is not a valid object instance",
    );
  });

  it("throws bad request when array contains null", () => {
    const instances = [new TestClass("test1"), null];
    expect(() => assertIsArrayOfInstances(instances, TestClass)).toThrow(
      "Item at index 1 is not a valid object instance",
    );
  });

  it("throws bad request when array contains undefined", () => {
    const instances = [new TestClass("test1"), undefined];
    expect(() => assertIsArrayOfInstances(instances, TestClass)).toThrow(
      "Item at index 1 is not a valid object instance",
    );
  });

  it("throws bad request when array contains primitives", () => {
    const instances = [new TestClass("test1"), "string"];
    expect(() => assertIsArrayOfInstances(instances, TestClass)).toThrow(
      "Item at index 1 is not a valid object instance",
    );
  });

  it("handles multiple invalid items and reports the first one", () => {
    const instances = [new TestClass("test1"), "string", 123, null];
    expect(() => assertIsArrayOfInstances(instances, TestClass)).toThrow(
      "Item at index 1 is not a valid object instance",
    );
  });
});

class TestClass {
  constructor(value) {
    this.value = value;
  }
}

class AnotherClass {
  constructor(name) {
    this.name = name;
  }
}
