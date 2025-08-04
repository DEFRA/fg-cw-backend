import { describe, expect, it } from "vitest";
import { typeSchema } from "./type.schema.js";

describe("typeSchema", () => {
  it("accepts valid string type", () => {
    const { error } = typeSchema.validate("string");
    expect(error).toBeUndefined();
  });

  it("accepts valid number type", () => {
    const { error } = typeSchema.validate("number");
    expect(error).toBeUndefined();
  });

  it("accepts valid boolean type", () => {
    const { error } = typeSchema.validate("boolean");
    expect(error).toBeUndefined();
  });

  it("accepts valid date type", () => {
    const { error } = typeSchema.validate("date");
    expect(error).toBeUndefined();
  });

  it("accepts valid object type", () => {
    const { error } = typeSchema.validate("object");
    expect(error).toBeUndefined();
  });

  it("accepts valid array type", () => {
    const { error } = typeSchema.validate("array");
    expect(error).toBeUndefined();
  });

  it("rejects invalid type", () => {
    const { error } = typeSchema.validate("invalid");
    expect(error.name).toEqual("ValidationError");
    expect(error.details[0].message).toEqual(
      '"value" must be one of [string, number, boolean, date, object, array]',
    );
  });

  it("rejects null value", () => {
    const { error } = typeSchema.validate(null);
    expect(error.name).toEqual("ValidationError");
    expect(error.details[0].message).toEqual(
      '"value" must be one of [string, number, boolean, date, object, array]',
    );
  });

  it("rejects undefined value", () => {
    const { error } = typeSchema.validate(undefined);
    expect(error).toBeDefined();
    expect(error.name).toEqual("ValidationError");
    expect(error.details[0].message).toEqual('"value" is required');
  });

  it("rejects empty string", () => {
    const { error } = typeSchema.validate("");
    expect(error.name).toEqual("ValidationError");
    expect(error.details[0].message).toEqual(
      '"value" must be one of [string, number, boolean, date, object, array]',
    );
  });
});
