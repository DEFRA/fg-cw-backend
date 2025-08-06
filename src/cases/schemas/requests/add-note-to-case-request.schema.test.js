import { describe, expect, it } from "vitest";
import { addNoteToCaseRequestSchema } from "./add-note-to-case-request.schema.js";

describe("addNoteToCaseRequestSchema", () => {
  it("validates valid request with type and text", () => {
    const validRequest = {
      type: "NOTE_ADDED",
      text: "This is a test note",
    };

    const { error, value } = addNoteToCaseRequestSchema.validate(validRequest);

    expect(error).toBeUndefined();
    expect(value).toEqual(validRequest);
  });

  it("strips unknown properties", () => {
    const requestWithUnknown = {
      type: "NOTE_ADDED",
      text: "This is a test note",
      unknownProperty: "should be stripped",
      anotherUnknown: 123,
    };

    const { error, value } =
      addNoteToCaseRequestSchema.validate(requestWithUnknown);

    expect(error).toBeUndefined();
    expect(value).toEqual({
      type: "NOTE_ADDED",
      text: "This is a test note",
    });
  });

  it("rejects request missing type", () => {
    const invalidRequest = {
      text: "This is a test note",
    };

    const { error } = addNoteToCaseRequestSchema.validate(invalidRequest);

    expect(error).toBeDefined();
    expect(error.details[0].message).toContain('"type" is required');
  });

  it("rejects request missing text", () => {
    const invalidRequest = {
      type: "NOTE_ADDED",
    };

    const { error } = addNoteToCaseRequestSchema.validate(invalidRequest);

    expect(error).toBeDefined();
    expect(error.details[0].message).toContain('"text" is required');
  });

  it("rejects request with empty type string", () => {
    const invalidRequest = {
      type: "",
      text: "This is a test note",
    };

    const { error } = addNoteToCaseRequestSchema.validate(invalidRequest);

    expect(error).toBeDefined();
    expect(error.details[0].message).toContain("is not allowed to be empty");
  });

  it("rejects request with empty text string", () => {
    const invalidRequest = {
      type: "NOTE_ADDED",
      text: "",
    };

    const { error } = addNoteToCaseRequestSchema.validate(invalidRequest);

    expect(error).toBeDefined();
    expect(error.details[0].message).toContain("is not allowed to be empty");
  });

  it("rejects request with null type", () => {
    const invalidRequest = {
      type: null,
      text: "This is a test note",
    };

    const { error } = addNoteToCaseRequestSchema.validate(invalidRequest);

    expect(error).toBeDefined();
    expect(error.details[0].message).toContain('"type" must be a string');
  });

  it("rejects request with null text", () => {
    const invalidRequest = {
      type: "NOTE_ADDED",
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
