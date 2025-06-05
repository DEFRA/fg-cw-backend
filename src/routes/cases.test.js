import { describe, expect, it, vi } from "vitest";
import { cases } from "./cases.js";
import {
  caseDetailController,
  caseListController
} from "../controllers/case.controller.js";
import { caseSchema } from "../schemas/case.schema.js";
import { commonSchema } from "../schemas/common.schema.js";

vi.mock("../controllers/case.controller.js");

describe("cases routes", () => {
  it("should define the GET /cases route", () => {
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

  it("should define the GET /cases/{caseId} route", () => {
    const route = cases.find(
      (r) => r.method === "GET" && r.path === "/cases/{caseId}"
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
