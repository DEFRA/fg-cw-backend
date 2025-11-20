import { describe, expect, it } from "vitest";
import {
  extractEndpointParameters,
  resolveParameterMap,
} from "./parameter-resolver.js";

describe("parameter-resolver", () => {
  describe("resolveParameterMap", () => {
    it("should resolve simple JSONPath parameters", async () => {
      const caseWorkflowContext = {
        _id: "case-123",
        caseRef: "REF-001",
        payload: {
          businessName: "Test Business",
          sbi: "123456789",
        },
      };

      const paramMap = {
        caseId: "$._id",
        businessName: "$.payload.businessName",
        sbi: "$.payload.sbi",
      };

      const result = await resolveParameterMap({
        paramMap,
        caseWorkflowContext,
      });

      expect(result).toEqual({
        caseId: "case-123",
        businessName: "Test Business",
        sbi: "123456789",
      });
    });

    it("should resolve JSONata expressions", async () => {
      const caseWorkflowContext = {
        payload: {
          amount: 1000,
          rate: 0.1,
        },
      };

      const paramMap = {
        total: "jsonata:$.payload.amount * $.payload.rate",
      };

      const result = await resolveParameterMap({
        paramMap,
        caseWorkflowContext,
      });

      expect(result).toEqual({
        total: 100,
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
        _id: "case-123",
      };

      const paramMap = {
        nonExistent: "$.nonExistent.path",
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
        workflow: {
          externalActions: [
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
        },
      };

      const result = await extractEndpointParameters({
        actionValue: "FETCH_APPLICATION",
        caseWorkflowContext,
      });

      expect(result).toEqual({
        PATH: {
          caseId: "case-123",
          appId: "APP-456",
        },
        REQUEST: {},
      });
    });

    it("should extract and resolve REQUEST parameters", async () => {
      const caseWorkflowContext = {
        payload: {
          name: "John Doe",
          email: "john@example.com",
        },
        workflow: {
          externalActions: [
            {
              code: "CREATE_USER",
              endpoint: {
                code: "CREATE_USER_ENDPOINT",
                endpointParams: {
                  REQUEST: {
                    name: "$.payload.name",
                    email: "$.payload.email",
                  },
                },
              },
            },
          ],
        },
      };

      const result = await extractEndpointParameters({
        actionValue: "CREATE_USER",
        caseWorkflowContext,
      });

      expect(result).toEqual({
        PATH: {},
        REQUEST: {
          name: "John Doe",
          email: "john@example.com",
        },
      });
    });

    it("should extract both PATH and REQUEST parameters", async () => {
      const caseWorkflowContext = {
        _id: "case-123",
        payload: {
          status: "approved",
          comments: "Looks good",
        },
        workflow: {
          externalActions: [
            {
              code: "UPDATE_STATUS",
              endpoint: {
                code: "UPDATE_STATUS_ENDPOINT",
                endpointParams: {
                  PATH: {
                    caseId: "$._id",
                  },
                  REQUEST: {
                    status: "$.payload.status",
                    comments: "$.payload.comments",
                  },
                },
              },
            },
          ],
        },
      };

      const result = await extractEndpointParameters({
        actionValue: "UPDATE_STATUS",
        caseWorkflowContext,
      });

      expect(result).toEqual({
        PATH: {
          caseId: "case-123",
        },
        REQUEST: {
          status: "approved",
          comments: "Looks good",
        },
      });
    });

    it("should return empty params when action not found", async () => {
      const caseWorkflowContext = {
        workflow: {
          externalActions: [
            {
              code: "SOME_ACTION",
              endpoint: {
                code: "SOME_ENDPOINT",
              },
            },
          ],
        },
      };

      const result = await extractEndpointParameters({
        actionValue: "NON_EXISTENT_ACTION",
        caseWorkflowContext,
      });

      expect(result).toEqual({
        PATH: {},
        REQUEST: {},
      });
    });

    it("should return empty params when action has no endpoint", async () => {
      const caseWorkflowContext = {
        workflow: {
          externalActions: [
            {
              code: "NO_ENDPOINT_ACTION",
            },
          ],
        },
      };

      const result = await extractEndpointParameters({
        actionValue: "NO_ENDPOINT_ACTION",
        caseWorkflowContext,
      });

      expect(result).toEqual({
        PATH: {},
        REQUEST: {},
      });
    });

    it("should return empty params when action has no endpointParams", async () => {
      const caseWorkflowContext = {
        workflow: {
          externalActions: [
            {
              code: "NO_PARAMS_ACTION",
              endpoint: {
                code: "NO_PARAMS_ENDPOINT",
              },
            },
          ],
        },
      };

      const result = await extractEndpointParameters({
        actionValue: "NO_PARAMS_ACTION",
        caseWorkflowContext,
      });

      expect(result).toEqual({
        PATH: {},
        REQUEST: {},
      });
    });

    it("should return empty params when workflow has no externalActions", async () => {
      const caseWorkflowContext = {
        workflow: {},
      };

      const result = await extractEndpointParameters({
        actionValue: "ANY_ACTION",
        caseWorkflowContext,
      });

      expect(result).toEqual({
        PATH: {},
        REQUEST: {},
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
        workflow: {
          externalActions: [
            {
              code: "FETCH_RULES",
              endpoint: {
                code: "FETCH_RULES_ENDPOINT",
                endpointParams: {
                  PATH: {
                    runId:
                      "jsonata:$.request.query.runId ? $.request.query.runId : $.payload.rulesCalculation.id",
                  },
                },
              },
            },
          ],
        },
      };

      const result = await extractEndpointParameters({
        actionValue: "FETCH_RULES",
        caseWorkflowContext,
      });

      expect(result).toEqual({
        PATH: {
          runId: "123",
        },
        REQUEST: {},
      });
    });

    it("should handle JSONata fallback when query param is missing", async () => {
      const caseWorkflowContext = {
        request: {
          query: {},
        },
        payload: {
          rulesCalculation: {
            id: 789,
          },
        },
        workflow: {
          externalActions: [
            {
              code: "FETCH_RULES",
              endpoint: {
                code: "FETCH_RULES_ENDPOINT",
                endpointParams: {
                  PATH: {
                    runId:
                      "jsonata:$.request.query.runId ? $.request.query.runId : $.payload.rulesCalculation.id",
                  },
                },
              },
            },
          ],
        },
      };

      const result = await extractEndpointParameters({
        actionValue: "FETCH_RULES",
        caseWorkflowContext,
      });

      expect(result).toEqual({
        PATH: {
          runId: 789,
        },
        REQUEST: {},
      });
    });

    it("should ignore unknown parameter types", async () => {
      const caseWorkflowContext = {
        _id: "case-123",
        workflow: {
          externalActions: [
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
          ],
        },
      };

      const result = await extractEndpointParameters({
        actionValue: "TEST_ACTION",
        caseWorkflowContext,
      });

      expect(result).toEqual({
        PATH: {
          caseId: "case-123",
        },
        REQUEST: {},
      });
    });
  });
});
