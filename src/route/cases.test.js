import { describe, expect, test, vi } from "vitest";
import { cases } from "./cases.js";
import {
  caseCreateController,
  caseDetailController,
  caseListController
} from "../controller/handlers.controller.js";
import { caseSchema } from "../schema/case.schema.js";
import { commonSchema } from "../schema/common.schema.js";

vi.mock("../controller/handlers.controller.js", () => ({
  caseCreateController: vi.fn(),
  caseDetailController: vi.fn(),
  caseListController: vi.fn(),
  caseStageController: vi.fn()
}));

describe("cases routes", () => {
  test("should define the POST /cases route", () => {
    const route = cases.find((r) => r.method === "POST" && r.path === "/cases");

    expect(route).toBeDefined();

    const { options, handler } = route;

    expect(handler).toBe(caseCreateController);
    expect(options).toHaveProperty(
      "description",
      "Temporary: Create a handlers"
    );
    expect(options).toHaveProperty("tags");
    expect(options.tags).toContain("api");
    expect(options.validate.payload).toBeDefined(); // Expect payload schema
    expect(options.response).toEqual({
      status: {
        201: caseSchema.Case,
        400: commonSchema.ValidationError
      }
    });
  });

  test("should define the GET /cases route", () => {
    const route = cases.find((r) => r.method === "GET" && r.path === "/cases");

    expect(route).toBeDefined();

    const { options, handler } = route;

    expect(handler).toBe(caseListController);
    expect(options).toHaveProperty("description", "Get all cases");
    expect(options).toHaveProperty("tags");
    expect(options.tags).toContain("api");
    expect(options.response).toEqual({
      status: {
        200: commonSchema.ListResponse,
        400: commonSchema.ValidationError
      }
    });
  });

  test("should define the GET /cases/{caseId} route", () => {
    const route = cases.find(
      (r) => r.method === "GET" && r.path === "/cases/{caseId}"
    );

    expect(route).toBeDefined();

    const { options, handler } = route;

    expect(handler).toBe(caseDetailController);
    expect(options).toHaveProperty("description", "Find a handlers by caseId");
    expect(options).toHaveProperty("tags");
    expect(options.tags).toContain("api");
    expect(options.validate.params.describe()).toMatchObject({
      type: "object",
      keys: {
        caseId: {
          type: "string"
        }
      }
    });
    expect(options.response).toEqual({
      status: {
        200: caseSchema.Case,
        400: commonSchema.ValidationError
      }
    });
  });
});
