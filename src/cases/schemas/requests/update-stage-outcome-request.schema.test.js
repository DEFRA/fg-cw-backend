import { describe, expect, it } from "vitest";
import { updateStageOutcomeRequestSchema } from "./update-stage-outcome-request.schema.js";

describe("updateStageOutcomeRequestSchema", () => {
  describe("valid requests", () => {
    it("validates valid request with actionId and comment", () => {
      const validRequest = {
        actionId: "approve",
        comment: "Application approved with conditions",
      };

      const { error, value } =
        updateStageOutcomeRequestSchema.validate(validRequest);

      expect(error).toBeUndefined();
      expect(value).toEqual(validRequest);
    });

    it("validates valid request with actionId only", () => {
      const validRequest = {
        actionId: "reject",
      };

      const { error, value } =
        updateStageOutcomeRequestSchema.validate(validRequest);

      expect(error).toBeUndefined();
      expect(value).toEqual(validRequest);
    });

    it("allows empty string comment", () => {
      const validRequest = {
        actionId: "approve",
        comment: "",
      };

      const { error, value } =
        updateStageOutcomeRequestSchema.validate(validRequest);

      expect(error).toBeUndefined();
      expect(value).toEqual(validRequest);
    });

    it("allows null comment", () => {
      const validRequest = {
        actionId: "approve",
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
        actionId: "approve",
        comment: "Test comment",
        unknownProperty: "should be stripped",
        extraField: 123,
        nested: { data: "removed" },
      };

      const { error, value } =
        updateStageOutcomeRequestSchema.validate(requestWithUnknown);

      expect(error).toBeUndefined();
      expect(value).toEqual({
        actionId: "approve",
        comment: "Test comment",
      });
      expect(value.unknownProperty).toBeUndefined();
      expect(value.extraField).toBeUndefined();
      expect(value.nested).toBeUndefined();
    });

    it("preserves valid properties while stripping unknown ones", () => {
      const requestWithMixed = {
        actionId: "reject",
        comment: "Reason for rejection",
        invalid: "removed",
        alsoInvalid: true,
      };

      const { error, value } =
        updateStageOutcomeRequestSchema.validate(requestWithMixed);

      expect(error).toBeUndefined();
      expect(value).toEqual({
        actionId: "reject",
        comment: "Reason for rejection",
      });
    });
  });

  describe("validation errors", () => {
    it("requires actionId", () => {
      const invalidRequest = {
        comment: "Test comment",
      };

      const { error } =
        updateStageOutcomeRequestSchema.validate(invalidRequest);

      expect(error).toBeDefined();
      expect(error.message).toContain('"actionId" is required');
    });

    it("rejects empty object", () => {
      const invalidRequest = {};

      const { error } =
        updateStageOutcomeRequestSchema.validate(invalidRequest);

      expect(error).toBeDefined();
      expect(error.message).toContain('"actionId" is required');
    });

    it("rejects non-string actionId", () => {
      const invalidRequests = [
        { actionId: 123 },
        { actionId: true },
        { actionId: [] },
        { actionId: {} },
      ];

      invalidRequests.forEach((request) => {
        const { error } = updateStageOutcomeRequestSchema.validate(request);
        expect(error).toBeDefined();
        expect(error.message).toContain('"actionId" must be a string');
      });
    });

    it("rejects empty string actionId", () => {
      const invalidRequest = {
        actionId: "",
      };

      const { error } =
        updateStageOutcomeRequestSchema.validate(invalidRequest);

      expect(error).toBeDefined();
      expect(error.message).toContain('"actionId" is not allowed to be empty');
    });

    it("rejects non-string comment when provided", () => {
      const invalidRequests = [
        { actionId: "approve", comment: 123 },
        { actionId: "approve", comment: true },
        { actionId: "approve", comment: [] },
        { actionId: "approve", comment: {} },
      ];

      invalidRequests.forEach((request) => {
        const { error } = updateStageOutcomeRequestSchema.validate(request);
        expect(error).toBeDefined();
        expect(error.message).toContain('"comment" must be a string');
      });
    });
  });
});
