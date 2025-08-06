import { describe, expect, it } from "vitest";
import { idSchema } from "./id.schema.js";

describe("idSchema", () => {
  it("validates valid 24-character hex string", () => {
    const validId = "64c88faac1f56f71e1b89a33";

    const { error, value } = idSchema.validate(validId);

    expect(error).toBeUndefined();
    expect(value).toBe(validId);
  });

  it("validates another valid 24-character hex string", () => {
    const validId = "507f1f77bcf86cd799439011";

    const { error, value } = idSchema.validate(validId);

    expect(error).toBeUndefined();
    expect(value).toBe(validId);
  });

  it("rejects string shorter than 24 characters", () => {
    const shortId = "64c88faac1f56f71e1b89a3";

    const { error } = idSchema.validate(shortId);

    expect(error).toBeDefined();
    expect(error.details[0].message).toContain(
      "length must be 24 characters long",
    );
  });

  it("rejects string longer than 24 characters", () => {
    const longId = "64c88faac1f56f71e1b89a333";

    const { error } = idSchema.validate(longId);

    expect(error).toBeDefined();
    expect(error.details[0].message).toContain(
      "length must be 24 characters long",
    );
  });

  it("rejects non-hex characters", () => {
    const nonHexId = "64c88faac1f56f71e1b89agg";

    const { error } = idSchema.validate(nonHexId);

    expect(error).toBeDefined();
    expect(error.details[0].message).toContain(
      "must only contain hexadecimal characters",
    );
  });

  it("rejects null value", () => {
    const { error } = idSchema.validate(null);

    expect(error).toBeDefined();
    expect(error.details[0].message).toContain("must be a string");
  });

  it("rejects number value", () => {
    const { error } = idSchema.validate(123);

    expect(error).toBeDefined();
    expect(error.details[0].message).toContain("must be a string");
  });

  it("rejects empty string", () => {
    const { error } = idSchema.validate("");

    expect(error).toBeDefined();
    expect(error.details[0].message).toContain("is not allowed to be empty");
  });

  it("rejects object value", () => {
    const { error } = idSchema.validate({ id: "64c88faac1f56f71e1b89a33" });

    expect(error).toBeDefined();
    expect(error.details[0].message).toContain("must be a string");
  });

  it("rejects array value", () => {
    const { error } = idSchema.validate(["64c88faac1f56f71e1b89a33"]);

    expect(error).toBeDefined();
    expect(error.details[0].message).toContain("must be a string");
  });
});
