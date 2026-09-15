import { describe, expect, it, vi } from "vitest";
import {
  VARIANT_PATTERN,
  getConfigurationVariant,
  logConfigurationVariant,
  variantFileName,
} from "./configuration-variant.js";

describe("configuration-variant", () => {
  describe("variantFileName", () => {
    it("should return the original file when variant is empty", () => {
      expect(variantFileName("cw.json", "")).toBe("cw.json");
    });

    it("should return the original file when variant is undefined", () => {
      expect(variantFileName("cw.json", undefined)).toBe("cw.json");
    });

    it("should insert the variant before .json", () => {
      expect(variantFileName("cw.json", "next")).toBe("cw.next.json");
    });
  });

  describe("VARIANT_PATTERN", () => {
    it.each(["next", "abc-123", "v2"])("should accept '%s'", (value) => {
      expect(VARIANT_PATTERN.test(value)).toBe(true);
    });

    it.each(["Next", "abc_123", "a b"])("should reject '%s'", (value) => {
      expect(VARIANT_PATTERN.test(value)).toBe(false);
    });
  });

  describe("getConfigurationVariant", () => {
    const makeConfig = (cdpEnvironment, variant) => ({
      get: (key) => {
        const values = {
          cdpEnvironment,
          "configBroker.variant": variant,
        };
        return values[key];
      },
    });

    it('should return "" when cdpEnvironment is "prod"', () => {
      expect(getConfigurationVariant(makeConfig("prod", "next"))).toBe("");
    });

    it("should return the raw variant when not prod", () => {
      expect(getConfigurationVariant(makeConfig("dev", "next"))).toBe("next");
    });

    it('should return "" when rawVariant is empty', () => {
      expect(getConfigurationVariant(makeConfig("dev", ""))).toBe("");
    });
  });

  describe("logConfigurationVariant", () => {
    const makeConfig = (cdpEnvironment, variant) => ({
      get: (key) => {
        const values = {
          cdpEnvironment,
          "configBroker.variant": variant,
        };
        return values[key];
      },
    });

    it("should do nothing when rawVariant is falsy", () => {
      const log = { info: vi.fn(), warn: vi.fn() };
      logConfigurationVariant(makeConfig("dev", ""), log);
      expect(log.info).not.toHaveBeenCalled();
      expect(log.warn).not.toHaveBeenCalled();
    });

    it("should log a warning in prod", () => {
      const log = { info: vi.fn(), warn: vi.fn() };
      logConfigurationVariant(makeConfig("prod", "next"), log);
      expect(log.warn).toHaveBeenCalledWith(
        expect.stringContaining("ignored because ENVIRONMENT is prod"),
      );
      expect(log.info).not.toHaveBeenCalled();
    });

    it("should log info outside prod", () => {
      const log = { info: vi.fn(), warn: vi.fn() };
      logConfigurationVariant(makeConfig("dev", "next"), log);
      expect(log.info).toHaveBeenCalledWith(
        expect.stringContaining('Configuration variant "next" active'),
      );
      expect(log.warn).not.toHaveBeenCalled();
    });
  });
});
