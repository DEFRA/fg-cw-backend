import { describe, it, expect } from "vitest";
import Joi from "joi";
import { workflows } from "./workflows.js";
import {
  workflowCreateController,
  workflowDetailController,
  workflowListController
} from "../controller/workflow.controller.js";

describe("Workflows route configuration tests", () => {
  it("should define the POST /workflows route with correct configuration", () => {
    const postRoute = workflows.find(
      (route) => route.method === "POST" && route.path === "/workflows"
    );

    expect(postRoute).toBeDefined();
    expect(postRoute.method).toBe("POST");
    expect(postRoute.path).toBe("/workflows");

    // Test options configuration
    const { options } = postRoute;
    expect(options.description).toBe("Create a workflow");
    expect(options.tags).toEqual(["api"]);

    // Validate payload schema
    expect(Joi.isSchema(options.validate.payload)).toBe(true);

    // Test response validation
    expect(options.response.status[201]).toBeDefined();
    expect(options.response.status[400]).toBeDefined();

    // Test handler
    expect(postRoute.handler).toBe(workflowCreateController);
  });

  it("should define the GET /workflows route with correct configuration", () => {
    const getListRoute = workflows.find(
      (route) => route.method === "GET" && route.path === "/workflows"
    );

    expect(getListRoute).toBeDefined();
    expect(getListRoute.method).toBe("GET");
    expect(getListRoute.path).toBe("/workflows");

    // Test options configuration
    const { options } = getListRoute;
    expect(options.description).toBe("Get all workflows");
    expect(options.tags).toEqual(["api"]);

    // Validate query schema
    expect(Joi.isSchema(options.validate.query)).toBe(true);
    const queryValidation = options.validate.query.validate({
      page: 1,
      pageSize: 10
    });
    expect(queryValidation.error).toBeUndefined();

    // Test response validation
    expect(options.response.status[200]).toBeDefined();
    expect(options.response.status[400]).toBeDefined();

    // Test handler
    expect(getListRoute.handler).toBe(workflowListController);
  });

  it("should define the GET /workflows/{workflowCode} route with correct configuration", () => {
    const getDetailRoute = workflows.find(
      (route) =>
        route.method === "GET" && route.path === "/workflows/{workflowCode}"
    );

    expect(getDetailRoute).toBeDefined();
    expect(getDetailRoute.method).toBe("GET");
    expect(getDetailRoute.path).toBe("/workflows/{workflowCode}");

    // Test options configuration
    const { options } = getDetailRoute;
    expect(options.description).toBe("Find a workflow by workflowCode");
    expect(options.tags).toEqual(["api"]);

    // Validate params schema
    expect(Joi.isSchema(options.validate.params)).toBe(true);
    const paramsValidation = options.validate.params.validate({
      code: "12345"
    });
    expect(paramsValidation.error).toBeUndefined();

    // Test response validation
    expect(options.response.status[200]).toBeDefined();
    expect(options.response.status[400]).toBeDefined();

    // Test handler
    expect(getDetailRoute.handler).toBe(workflowDetailController);
  });

  it("should not define unexpected routes", () => {
    const unexpectedRoute = workflows.find(
      (route) => !["POST", "GET"].includes(route.method)
    );
    expect(unexpectedRoute).toBeUndefined();
  });
});
