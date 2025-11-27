import { describe, expect, it } from "vitest";
import { Workflow } from "../cases/models/workflow.js";
import {
  extractEndpointParameters,
  resolveParameterMap,
} from "./parameter-resolver.js";

describe("parameter-resolver", () => {
  const createMockWorkflowWithActions = (externalActions, endpoints = []) => {
    return Workflow.createMock({
      code: "FRPS",
      externalActions,
      endpoints,
    });
  };

  describe("resolveParameterMap", () => {
    it("should resolve simple JSONPath parameters", async () => {
      const caseWorkflowContext = {
        _id: "case-123",
        payload: {
          amount: 500,
        },
      };

      const paramMap = {
        id: "$._id",
        amount: "$.payload.amount",
      };

      const result = await resolveParameterMap({
        paramMap,
        caseWorkflowContext,
      });

      expect(result).toEqual({
        id: "case-123",
        amount: 500,
      });
    });

    it("should resolve JSONata expressions", async () => {
      const caseWorkflowContext = {
        payload: {
          amount: 500,
          multiplier: 2,
        },
      };

      const paramMap = {
        doubled: "jsonata:$.payload.amount * $.payload.multiplier",
      };

      const result = await resolveParameterMap({
        paramMap,
        caseWorkflowContext,
      });

      expect(result).toEqual({
        doubled: 1000,
      });
    });

    it("should handle empty parameter map", async () => {
      const caseWorkflowContext = {
        _id: "case-123",
      };

      const paramMap = {};

      const result = await resolveParameterMap({
        paramMap,
        caseWorkflowContext,
      });

      expect(result).toEqual({});
    });

    it("should resolve undefined paths as empty string", async () => {
      const caseWorkflowContext = {
        payload: {},
      };

      const paramMap = {
        nonExistent: "$.payload.nonExistent",
      };

      const result = await resolveParameterMap({
        paramMap,
        caseWorkflowContext,
      });

      expect(result).toEqual({
        nonExistent: "",
      });
    });

    it("should resolve multiple parameters with mixed types", async () => {
      const caseWorkflowContext = {
        _id: "case-123",
        payload: {
          amount: 500,
          multiplier: 2,
        },
      };

      const paramMap = {
        id: "$._id",
        amount: "$.payload.amount",
        doubled: "jsonata:$.payload.amount * $.payload.multiplier",
        staticValue: "static-string",
      };

      const result = await resolveParameterMap({
        paramMap,
        caseWorkflowContext,
      });

      expect(result).toEqual({
        id: "case-123",
        amount: 500,
        doubled: 1000,
        staticValue: "static-string",
      });
    });
  });

  describe("extractEndpointParameters", () => {
    it("should extract and resolve PATH parameters", async () => {
      const caseWorkflowContext = {
        _id: "case-123",
        payload: {
          applicationId: "APP-456",
        },
        workflow: createMockWorkflowWithActions(
          [
            {
              code: "FETCH_APPLICATION",
              endpoint: {
                code: "FETCH_APP_ENDPOINT",
                endpointParams: {
                  PATH: {
                    caseId: "$._id",
                    appId: "$.payload.applicationId",
                  },
                },
              },
            },
          ],
          [
            {
              code: "FETCH_APP_ENDPOINT",
              service: "APPLICATION_SERVICE",
              path: "/api/applications",
              method: "GET",
            },
          ],
        ),
      };

      const result = await extractEndpointParameters({
        actionCode: "FETCH_APPLICATION",
        caseWorkflowContext,
      });

      expect(result).toEqual({
        PATH: {
          caseId: "case-123",
          appId: "APP-456",
        },
        BODY: {},
      });
    });

    it("should extract and resolve BODY parameters", async () => {
      const caseWorkflowContext = {
        payload: {
          name: "John Doe",
          email: "john@example.com",
        },
        workflow: createMockWorkflowWithActions([
          {
            code: "CREATE_USER",
            endpoint: {
              code: "CREATE_USER_ENDPOINT",
              endpointParams: {
                BODY: {
                  name: "$.payload.name",
                  email: "$.payload.email",
                },
              },
            },
          },
        ]),
      };

      const result = await extractEndpointParameters({
        actionCode: "CREATE_USER",
        caseWorkflowContext,
      });

      expect(result).toEqual({
        PATH: {},
        BODY: {
          name: "John Doe",
          email: "john@example.com",
        },
      });
    });

    it("should extract both PATH and BODY parameters", async () => {
      const caseWorkflowContext = {
        _id: "case-123",
        payload: {
          status: "approved",
          comments: "Looks good",
        },
        workflow: createMockWorkflowWithActions([
          {
            code: "UPDATE_STATUS",
            endpoint: {
              code: "UPDATE_STATUS_ENDPOINT",
              endpointParams: {
                PATH: {
                  caseId: "$._id",
                },
                BODY: {
                  status: "$.payload.status",
                  comments: "$.payload.comments",
                },
              },
            },
          },
        ]),
      };

      const result = await extractEndpointParameters({
        actionCode: "UPDATE_STATUS",
        caseWorkflowContext,
      });

      expect(result).toEqual({
        PATH: {
          caseId: "case-123",
        },
        BODY: {
          status: "approved",
          comments: "Looks good",
        },
      });
    });

    it("should extract BODY parameters", async () => {
      const caseWorkflowContext = {
        supplementaryData: {
          rulesCalculations: [
            { id: 905, valid: true, date: "2025-10-25T22:08:43.553Z" },
          ],
        },
        workflow: createMockWorkflowWithActions([
          {
            code: "RECALCULATE_RULES",
            endpoint: {
              code: "RECALCULATE_RULES_ENDPOINT",
              endpointParams: {
                BODY: {
                  id: "$.supplementaryData.rulesCalculations[0].id",
                  requesterUsername: "CASEWORKING_SYSTEM",
                },
              },
            },
          },
        ]),
      };

      const result = await extractEndpointParameters({
        actionCode: "RECALCULATE_RULES",
        caseWorkflowContext,
      });

      expect(result).toEqual({
        PATH: {},
        BODY: {
          id: 905,
          requesterUsername: "CASEWORKING_SYSTEM",
        },
      });
    });

    it("should handle both PATH and BODY parameters", async () => {
      const caseWorkflowContext = {
        _id: "case-123",
        supplementaryData: {
          rulesCalculations: [{ id: 905 }],
        },
        workflow: createMockWorkflowWithActions([
          {
            code: "MIXED_PARAMS_ACTION",
            endpoint: {
              code: "MIXED_PARAMS_ENDPOINT",
              endpointParams: {
                PATH: {
                  caseId: "$._id",
                },
                BODY: {
                  ruleId: "$.supplementaryData.rulesCalculations[0].id",
                },
              },
            },
          },
        ]),
      };

      const result = await extractEndpointParameters({
        actionCode: "MIXED_PARAMS_ACTION",
        caseWorkflowContext,
      });

      expect(result).toEqual({
        PATH: {
          caseId: "case-123",
        },
        BODY: {
          ruleId: 905,
        },
      });
    });

    it("should return empty params when action not found", async () => {
      const caseWorkflowContext = {
        workflow: createMockWorkflowWithActions([
          {
            code: "SOME_ACTION",
            endpoint: {
              code: "SOME_ENDPOINT",
            },
          },
        ]),
      };

      const result = await extractEndpointParameters({
        actionCode: "NON_EXISTENT_ACTION",
        caseWorkflowContext,
      });

      expect(result).toEqual({
        PATH: {},
        BODY: {},
      });
    });

    it("should return empty params when action has no endpoint", async () => {
      const caseWorkflowContext = {
        workflow: createMockWorkflowWithActions([
          {
            code: "NO_ENDPOINT_ACTION",
          },
        ]),
      };

      const result = await extractEndpointParameters({
        actionCode: "NO_ENDPOINT_ACTION",
        caseWorkflowContext,
      });

      expect(result).toEqual({
        PATH: {},
        BODY: {},
      });
    });

    it("should return empty params when action has no endpointParams", async () => {
      const caseWorkflowContext = {
        workflow: createMockWorkflowWithActions([
          {
            code: "NO_PARAMS_ACTION",
            endpoint: {
              code: "NO_PARAMS_ENDPOINT",
            },
          },
        ]),
      };

      const result = await extractEndpointParameters({
        actionCode: "NO_PARAMS_ACTION",
        caseWorkflowContext,
      });

      expect(result).toEqual({
        PATH: {},
        BODY: {},
      });
    });

    it("should return empty params when workflow has no externalActions", async () => {
      const caseWorkflowContext = {
        workflow: createMockWorkflowWithActions([]),
      };

      const result = await extractEndpointParameters({
        actionCode: "ANY_ACTION",
        caseWorkflowContext,
      });

      expect(result).toEqual({
        PATH: {},
        BODY: {},
      });
    });

    it("should handle JSONata expressions in parameters", async () => {
      const caseWorkflowContext = {
        request: {
          query: {
            runId: "123",
          },
        },
        payload: {
          rulesCalculation: {
            id: 456,
          },
        },
        workflow: createMockWorkflowWithActions([
          {
            code: "FETCH_RULES",
            endpoint: {
              code: "FETCH_RULES_ENDPOINT",
              endpointParams: {
                PATH: {
                  runId:
                    "jsonata:$.request.query.runId ? $.request.query.runId : $.payload.answers.rulesCalculations.id",
                },
              },
            },
          },
        ]),
      };

      const result = await extractEndpointParameters({
        actionCode: "FETCH_RULES",
        caseWorkflowContext,
      });

      expect(result).toEqual({
        PATH: {
          runId: "123",
        },
        BODY: {},
      });
    });

    it("should handle JSONata fallback when query param is missing", async () => {
      const caseWorkflowContext = {
        request: {
          query: {},
        },
        payload: {
          answers: {
            rulesCalculations: {
              id: 789,
            },
          },
        },
        workflow: createMockWorkflowWithActions([
          {
            code: "FETCH_RULES",
            endpoint: {
              code: "FETCH_RULES_ENDPOINT",
              endpointParams: {
                PATH: {
                  runId:
                    "jsonata:$.request.query.runId ? $.request.query.runId : $.payload.answers.rulesCalculations.id",
                },
              },
            },
          },
        ]),
      };

      const result = await extractEndpointParameters({
        actionCode: "FETCH_RULES",
        caseWorkflowContext,
      });

      expect(result).toEqual({
        PATH: {
          runId: 789,
        },
        BODY: {},
      });
    });

    it("should throw error for unknown parameter types", async () => {
      const caseWorkflowContext = {
        _id: "case-123",
        workflow: createMockWorkflowWithActions([
          {
            code: "TEST_ACTION",
            endpoint: {
              code: "TEST_ENDPOINT",
              endpointParams: {
                PATH: {
                  caseId: "$._id",
                },
                UNKNOWN_TYPE: {
                  someParam: "value",
                },
              },
            },
          },
        ]),
      };

      await expect(
        extractEndpointParameters({
          actionCode: "TEST_ACTION",
          caseWorkflowContext,
        }),
      ).rejects.toThrow("Unsupported endpoint parameter type: UNKNOWN_TYPE");
    });
  });
});
