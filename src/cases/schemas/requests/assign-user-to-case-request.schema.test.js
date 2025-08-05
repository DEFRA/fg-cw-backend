import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";
import { assignUserToCaseRequestSchema } from "./assign-user-to-case-request.schema.js";

describe("assignUserToCaseRequestSchema", () => {
  it("allows valid assignedUserId", () => {
    const assignedUserId = new ObjectId().toHexString();

    const { error } = assignUserToCaseRequestSchema.validate({
      assignedUserId,
    });
    expect(error).toBeUndefined();
  });

  it("allows assignedUserId to be null", () => {
    const { error } = assignUserToCaseRequestSchema.validate({
      assignedUserId: null,
    });
    expect(error).toBeUndefined();
  });

  it("requires assignedUserId", () => {
    const { error } = assignUserToCaseRequestSchema.validate({});
    expect(error.name).toEqual("ValidationError");
    expect(error.details[0].message).toContain('"assignedUserId" is required');
  });

  it("allows note text to be passed", () => {
    const { error } = assignUserToCaseRequestSchema.validate({
      assignedUserId: null,
      notes: "This is a note for assigning user...",
    });
    expect(error).toBeUndefined();
  });

  it("expects note text to be a string", () => {
    const { error } = assignUserToCaseRequestSchema.validate({
      assignedUserId: null,
      notes: 1234,
    });
    expect(error.details[0].message).toBe('"notes" must be a string');
  });
});
