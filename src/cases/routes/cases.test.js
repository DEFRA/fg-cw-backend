import { describe, expect, it, vi } from "vitest";
import {
  caseCreateController,
  caseDetailController,
  caseListController,
} from "../controllers/case.controller.js";
import { caseSchema } from "../schemas/case.schema.js";
import { commonSchema } from "../schemas/common.schema.js";
import { casesRoutes } from "./cases.js";

vi.mock("../controllers/case.controller.js");

describe("cases routes", () => {
  it("should define the POST /cases route", () => {
    const route = casesRoutes.find(
      (r) => r.method === "POST" && r.path === "/cases",
    );

    expect(route).toBeDefined();

    const { options, handler } = route;

    expect(handler).toBe(caseCreateController);
    expect(options).toHaveProperty("description", "Temporary: Create a case");
    expect(options).toHaveProperty("tags");
    expect(options.tags).toContain("api");
    expect(options.validate.payload).toBeDefined(); // Expect payload schema
    expect(options.response).toEqual({
      status: {
        201: caseSchema.Case,
        400: commonSchema.ValidationError,
      },
    });
  });

  it("should define the GET /cases route", () => {
    const route = casesRoutes.find(
      (r) => r.method === "GET" && r.path === "/cases",
    );

    expect(route).toBeDefined();

    const { options, handler } = route;

    expect(handler).toBe(caseListController);
    expect(options).toHaveProperty("description", "Get all cases");
    expect(options).toHaveProperty("tags");
    expect(options.tags).toContain("api");
    expect(options.response).toEqual({
      status: {
        200: commonSchema.ListResponse,
        400: commonSchema.ValidationError,
      },
    });
  });

  it("should define the GET /cases/{caseId} route", () => {
    const route = casesRoutes.find(
      (r) => r.method === "GET" && r.path === "/cases/{caseId}",
    );

    expect(route).toBeDefined();

    const { options, handler } = route;

    expect(handler).toBe(caseDetailController);
    expect(options).toHaveProperty("description", "Find a case by caseId");
    expect(options).toHaveProperty("tags");
    expect(options.tags).toContain("api");
    expect(options.validate.params.describe()).toMatchObject({
      type: "object",
      keys: {
        caseId: {
          type: "string",
        },
      },
    });
    expect(options.response).toEqual({
      status: {
        200: caseSchema.Case,
        400: commonSchema.ValidationError,
      },
    });
  });
});
