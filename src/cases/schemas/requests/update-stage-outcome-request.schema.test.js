import { describe, expect, it } from "vitest";
import { updateStageOutcomeRequestSchema } from "./update-stage-outcome-request.schema.js";

describe("updateStageOutcomeRequestSchema", () => {
  describe("valid requests", () => {
    it("validates valid request with actionCode and comment", () => {
      const validRequest = {
        actionCode: "APPROVE",
        comment: "Application approved with conditions",
      };

      const { error, value } =
        updateStageOutcomeRequestSchema.validate(validRequest);

      expect(error).toBeUndefined();
      expect(value).toEqual(validRequest);
    });

    it("validates valid request with actionCode only", () => {
      const validRequest = {
        actionCode: "REJECT",
      };

      const { error, value } =
        updateStageOutcomeRequestSchema.validate(validRequest);

      expect(error).toBeUndefined();
      expect(value).toEqual(validRequest);
    });

    it("allows empty string comment", () => {
      const validRequest = {
        actionCode: "APPROVE",
        comment: "",
      };

      const { error, value } =
        updateStageOutcomeRequestSchema.validate(validRequest);

      expect(error).toBeUndefined();
      expect(value).toEqual(validRequest);
    });

    it("allows null comment", () => {
      const validRequest = {
        actionCode: "APPROVE",
        comment: null,
      };

      const { error, value } =
        updateStageOutcomeRequestSchema.validate(validRequest);

      expect(error).toBeUndefined();
      expect(value).toEqual(validRequest);
    });
  });

  describe("strips unknown properties", () => {
    it("removes unknown properties from request", () => {
      const requestWithUnknown = {
        actionCode: "APPROVE",
        comment: "Test comment",
        unknownProperty: "should be stripped",
        extraField: 123,
        nested: { data: "removed" },
      };

      const { error, value } =
        updateStageOutcomeRequestSchema.validate(requestWithUnknown);

      expect(error).toBeUndefined();
      expect(value).toEqual({
        actionCode: "APPROVE",
        comment: "Test comment",
      });
      expect(value.unknownProperty).toBeUndefined();
      expect(value.extraField).toBeUndefined();
      expect(value.nested).toBeUndefined();
    });

    it("preserves valid properties while stripping unknown ones", () => {
      const requestWithMixed = {
        actionCode: "REJECT",
        comment: "Reason for rejection",
        invalid: "removed",
        alsoInvalid: true,
      };

      const { error, value } =
        updateStageOutcomeRequestSchema.validate(requestWithMixed);

      expect(error).toBeUndefined();
      expect(value).toEqual({
        actionCode: "REJECT",
        comment: "Reason for rejection",
      });
    });
  });

  describe("validation errors", () => {
    it("requires actionCode", () => {
      const invalidRequest = {
        comment: "Test comment",
      };

      const { error } =
        updateStageOutcomeRequestSchema.validate(invalidRequest);

      expect(error).toBeDefined();
      expect(error.message).toContain('"actionCode" is required');
    });

    it("rejects empty object", () => {
      const invalidRequest = {};

      const { error } =
        updateStageOutcomeRequestSchema.validate(invalidRequest);

      expect(error).toBeDefined();
      expect(error.message).toContain('"actionCode" is required');
    });

    it("rejects non-string actionCode", () => {
      const invalidRequests = [
        { actionCode: 123 },
        { actionCode: true },
        { actionCode: [] },
        { actionCode: {} },
      ];

      invalidRequests.forEach((request) => {
        const { error } = updateStageOutcomeRequestSchema.validate(request);
        expect(error).toBeDefined();
        expect(error.message).toContain('"actionCode" must be a string');
      });
    });

    it("rejects empty string actionCode", () => {
      const invalidRequest = {
        actionCode: "",
      };

      const { error } =
        updateStageOutcomeRequestSchema.validate(invalidRequest);

      expect(error).toBeDefined();
      expect(error.message).toContain(
        '"actionCode" is not allowed to be empty',
      );
    });

    it("rejects non-string comment when provided", () => {
      const invalidRequests = [
        { actionCode: "APPROVE", comment: 123 },
        { actionCode: "APPROVE", comment: true },
        { actionCode: "APPROVE", comment: [] },
        { actionCode: "APPROVE", comment: {} },
      ];

      invalidRequests.forEach((request) => {
        const { error } = updateStageOutcomeRequestSchema.validate(request);
        expect(error).toBeDefined();
        expect(error.message).toContain('"comment" must be a string');
      });
    });
  });
});
