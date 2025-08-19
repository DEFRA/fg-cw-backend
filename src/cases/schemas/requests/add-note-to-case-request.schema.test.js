import { describe, expect, it } from "vitest";
import { addNoteToCaseRequestSchema } from "./add-note-to-case-request.schema.js";

describe("addNoteToCaseRequestSchema", () => {
  it("validates valid request with type and text", () => {
    const validRequest = {
      text: "This is a test note",
    };

    const { error, value } = addNoteToCaseRequestSchema.validate(validRequest);

    expect(error).toBeUndefined();
    expect(value).toEqual(validRequest);
  });

  it("strips unknown properties", () => {
    const requestWithUnknown = {
      text: "This is a test note",
      unknownProperty: "should be stripped",
      anotherUnknown: 123,
    };

    const { error, value } =
      addNoteToCaseRequestSchema.validate(requestWithUnknown);

    expect(error).toBeUndefined();
    expect(value).toEqual({
      text: "This is a test note",
    });
  });

  it("rejects request missing text", () => {
    const invalidRequest = {};

    const { error } = addNoteToCaseRequestSchema.validate(invalidRequest);

    expect(error).toBeDefined();
    expect(error.details[0].message).toContain('"text" is required');
  });

  it("rejects request with empty text string", () => {
    const invalidRequest = {
      text: "",
    };

    const { error } = addNoteToCaseRequestSchema.validate(invalidRequest);

    expect(error).toBeDefined();
    expect(error.details[0].message).toContain("is not allowed to be empty");
  });

  it("rejects request with null text", () => {
    const invalidRequest = {
      text: null,
    };

    const { error } = addNoteToCaseRequestSchema.validate(invalidRequest);

    expect(error).toBeDefined();
    expect(error.details[0].message).toContain('"text" must be a string');
  });

  it("rejects null request", () => {
    const { error } = addNoteToCaseRequestSchema.validate(null);

    expect(error).toBeDefined();
    expect(error.details[0].message).toContain(
      '"AddNoteToCaseRequestSchema" must be of type object',
    );
  });

  it("rejects undefined request", () => {
    const { error } = addNoteToCaseRequestSchema.validate(undefined);

    expect(error).toBeDefined();
    expect(error.details[0].message).toContain(
      '"AddNoteToCaseRequestSchema" is required',
    );
  });

  it("rejects string request", () => {
    const { error } = addNoteToCaseRequestSchema.validate("not an object");

    expect(error).toBeDefined();
    expect(error.details[0].message).toContain(
      '"AddNoteToCaseRequestSchema" must be of type object',
    );
  });

  it("rejects array request", () => {
    const { error } = addNoteToCaseRequestSchema.validate([]);

    expect(error).toBeDefined();
    expect(error.details[0].message).toContain(
      '"AddNoteToCaseRequestSchema" must be of type object',
    );
  });
});
