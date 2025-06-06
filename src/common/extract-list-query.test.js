import { describe, expect, it, vi } from "vitest";
import { config } from "./config.js";
import { extractListQuery } from "./extract-list-query.js";

vi.mock("./config.js");

describe("extractListQuery", () => {
  it("should return default values when no query parameters are provided", () => {
    const mockApiConfig = {
      pageSize: 10,
    };
    config.get.mockReturnValue(mockApiConfig);

    const request = {
      query: {},
    };

    const result = extractListQuery(request);

    // Default values - if no page size request param then assume paging not required - default limit 100
    expect(result).toEqual({
      page: 1,
      pageSize: 100,
    });
  });

  it("should parse and return page and pageSize from query parameters", () => {
    const request = {
      query: {
        page: "2",
        pageSize: "20",
      },
    };

    const result = extractListQuery(request);

    expect(result).toEqual({
      page: 2,
      pageSize: 20,
    });

    // Ensure no config fallback was needed
    expect(config.get).not.toHaveBeenCalled();
  });

  it("should use default page when query.page is invalid", () => {
    const request = {
      query: {
        page: "invalid",
        pageSize: "25",
      },
    };

    const result = extractListQuery(request);

    expect(result.page).toBe(1); // Default page is 1
    expect(result.pageSize).toBe(25); // Valid pageSize is preserved
  });

  it("should use default pageSize from config when query.pageSize is invalid", () => {
    const mockApiConfig = {
      pageSize: 15,
    };
    config.get.mockReturnValue(mockApiConfig);

    const request = {
      query: {
        page: "3",
        pageSize: "invalid",
      },
    };

    const result = extractListQuery(request);

    expect(result.page).toBe(3); // Valid page is preserved
    expect(result.pageSize).toBe(mockApiConfig.pageSize); // Default from config
    expect(config.get).toHaveBeenCalledWith("api");
  });

  it("should use a hardcoded default pageSize if config does not provide a value", () => {
    config.get.mockReturnValue(undefined); // Simulate no config value

    const request = {
      query: {
        page: "1",
      },
    };

    const result = extractListQuery(request);

    // Default hardcoded values
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(100); // Hardcoded fallback value
  });

  it("should handle unexpected query structure gracefully", () => {
    const mockApiConfig = {
      pageSize: 10,
    };
    config.get.mockReturnValue(mockApiConfig);

    const request = {
      query: null, // Simulated unexpected structure
    };

    const mockConfigPageSize = 10;
    config.get.mockReturnValue(mockConfigPageSize);

    const result = extractListQuery(request);

    // Default values - if no page size request param then assume paging not required - default limit 100
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(100); // Config fallback
  });
});
