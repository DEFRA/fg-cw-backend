import { describe, expect, it } from "vitest";
import { WorkflowEndpoint } from "./workflow-endpoint.js";

describe("WorkflowEndpoint", () => {
  describe("fromDefinition", () => {
    const definition = (overrides = {}) => ({
      code: "FETCH_RULES_ENDPOINT",
      service: "RULES_ENGINE",
      path: "/api/v1/rules/{runId}",
      method: "GET",
      ...overrides,
    });

    it("builds an endpoint from a published definition", () => {
      expect(WorkflowEndpoint.fromDefinition(definition())).toEqual(
        new WorkflowEndpoint(definition()),
      );
    });

    it.each(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"])(
      "accepts the %s method",
      (method) => {
        expect(() =>
          WorkflowEndpoint.fromDefinition(definition({ method })),
        ).not.toThrow();
      },
    );

    it.each([
      ["no service", { service: undefined }, '"service" is required'],
      ["no path", { path: undefined }, '"path" is required'],
      ["no method", { method: undefined }, '"method" is required'],
      ["an unknown method", { method: "FETCH" }, '"method" must be one of'],
      ["a lower case method", { method: "get" }, '"method" must be one of'],
    ])("rejects an endpoint with %s", (_, overrides, reason) => {
      expect(() =>
        WorkflowEndpoint.fromDefinition(definition(overrides)),
      ).toThrow(`Invalid WorkflowEndpoint "FETCH_RULES_ENDPOINT": ${reason}`);
    });
  });
});
