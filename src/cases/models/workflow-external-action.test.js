import { describe, expect, it } from "vitest";
import { WorkflowEndpoint } from "./workflow-endpoint.js";
import { WorkflowExternalAction } from "./workflow-external-action.js";

describe("WorkflowExternalAction", () => {
  describe("fromDefinition", () => {
    const endpoints = [
      WorkflowEndpoint.createMock({ code: "RECALCULATE_RULES_ENDPOINT" }),
    ];

    const definition = (overrides = {}) => ({
      code: "RECALCULATE_RULES",
      name: "Run calculations again",
      description: "Rerun the business rules validation",
      display: true,
      endpoint: {
        code: "RECALCULATE_RULES_ENDPOINT",
        endpointParams: {
          PATH: { runId: "$.payload.runId" },
          BODY: { id: "$.payload.identifiers.frn" },
          HEADERS: { "x-user": "$.user.email" },
        },
      },
      target: {
        position: null,
        targetNode: "rulesCalculations",
        dataType: "ARRAY",
        place: "append",
      },
      ...overrides,
    });

    const fromDefinition = (overrides) => () =>
      WorkflowExternalAction.fromDefinition(definition(overrides), endpoints);

    const withEndpointParams = (endpointParams) => ({
      endpoint: { code: "RECALCULATE_RULES_ENDPOINT", endpointParams },
    });

    it("builds an external action from a published definition", () => {
      expect(fromDefinition()()).toEqual(
        new WorkflowExternalAction(definition()),
      );
    });

    it.each([
      [
        "no endpoint params",
        { endpoint: { code: "RECALCULATE_RULES_ENDPOINT" } },
      ],
      ["no target", { target: null }],
      [
        "an OBJECT target with a key",
        { target: { targetNode: "rules", dataType: "OBJECT", key: "id" } },
      ],
    ])("accepts an external action with %s", (_, overrides) => {
      expect(fromDefinition(overrides)).not.toThrow();
    });

    it.each([
      [
        "a string",
        "RECALCULATE_RULES_ENDPOINT",
        '"endpoint" must be of type object',
      ],
      ["missing", undefined, '"endpoint" is required'],
      ["without a code", {}, '"endpoint.code" is required'],
    ])("rejects an endpoint that is %s", (_, endpoint, reason) => {
      expect(fromDefinition({ endpoint })).toThrow(
        `Invalid WorkflowExternalAction "RECALCULATE_RULES": ${reason}`,
      );
    });

    it("rejects an endpoint code the workflow does not define", () => {
      expect(
        fromDefinition({ endpoint: { code: "MISSING_ENDPOINT" } }),
      ).toThrow(
        'Invalid WorkflowExternalAction "RECALCULATE_RULES": endpoint "MISSING_ENDPOINT" is not one of the workflow\'s endpoints',
      );
    });

    it.each([
      [
        "an unknown kind",
        { QUERY: { id: "$.id" } },
        '"endpoint.endpointParams.QUERY" is not allowed',
      ],
      [
        "a kind that is not a map",
        { PATH: "$.id" },
        '"endpoint.endpointParams.PATH" must be of type object',
      ],
      [
        "a value that is not a string",
        { BODY: { id: 1 } },
        '"endpoint.endpointParams.BODY.id" must be a string',
      ],
    ])("rejects endpoint params with %s", (_, endpointParams, reason) => {
      expect(fromDefinition(withEndpointParams(endpointParams))).toThrow(
        `Invalid WorkflowExternalAction "RECALCULATE_RULES": ${reason}`,
      );
    });

    it.each([
      [
        "an unknown data type",
        { targetNode: "rules", dataType: "MAP" },
        '"target.dataType" must be one of [ARRAY, OBJECT]',
      ],
      [
        "no data type",
        { targetNode: "rules" },
        '"target.dataType" is required',
      ],
      [
        "an OBJECT data type and no key",
        { targetNode: "rules", dataType: "OBJECT" },
        '"target.key" is required',
      ],
    ])("rejects a target with %s", (_, target, reason) => {
      expect(fromDefinition({ target })).toThrow(
        `Invalid WorkflowExternalAction "RECALCULATE_RULES": ${reason}`,
      );
    });
  });
});
