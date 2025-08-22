import Joi from "joi";
import { describe, expect, it, vi } from "vitest";
import { logger } from "../../common/logger.js";
import { validateModel } from "./validate-model.js";

vi.mock("../../common/logger.js", () => ({
  logger: {
    warn: vi.fn(),
  },
}));

describe("validateModel", () => {
  const testSchema = Joi.object({
    id: Joi.string().required(),
    name: Joi.string().required(),
    optional: Joi.string().optional(),
  }).label("TestSchema");

  describe("when validation succeeds", () => {
    it("returns validated value with required properties", () => {
      const props = {
        id: "test-id",
        name: "test-name",
      };

      const result = validateModel(props, testSchema);

      expect(result).toEqual({
        id: "test-id",
        name: "test-name",
      });
    });

    it("returns validated value with optional properties", () => {
      const props = {
        id: "test-id",
        name: "test-name",
        optional: "optional-value",
      };

      const result = validateModel(props, testSchema);

      expect(result).toEqual({
        id: "test-id",
        name: "test-name",
        optional: "optional-value",
      });
    });

    it("strips unknown properties", () => {
      const props = {
        id: "test-id",
        name: "test-name",
        unknownProperty: "should-be-stripped",
      };

      const result = validateModel(props, testSchema);

      expect(result).toEqual({
        id: "test-id",
        name: "test-name",
      });
      expect(result.unknownProperty).toBeUndefined();
    });
  });

  describe("when validation fails", () => {
    it("throws BadRequest error for missing required field", () => {
      const props = {
        name: "test-name",
      };

      expect(() => validateModel(props, testSchema)).toThrowError(
        'Invalid TestSchema: "id" is required',
      );
    });

    it("throws BadRequest error for invalid field type", () => {
      const props = {
        id: 123,
        name: "test-name",
      };

      expect(() => validateModel(props, testSchema)).toThrowError(
        'Invalid TestSchema: "id" must be a string',
      );
    });

    it("throws BadRequest error with multiple validation errors", () => {
      const props = {};

      expect(() => validateModel(props, testSchema)).toThrowError(
        'Invalid TestSchema: "id" is required, "name" is required',
      );
    });

    it("logs warning when validation fails", () => {
      const props = {
        name: "test-name",
      };

      expect(() => validateModel(props, testSchema)).toThrow();

      expect(logger.warn).toHaveBeenCalledWith(
        expect.any(Object),
        'Invalid TestSchema: "id" is required',
      );
    });

    it("uses Unknown as schema label when no label provided", () => {
      const schemaWithoutLabel = Joi.object({
        id: Joi.string().required(),
      });

      const props = {};

      expect(() => validateModel(props, schemaWithoutLabel)).toThrowError(
        'Invalid Unknown: "id" is required',
      );
    });
  });
});
