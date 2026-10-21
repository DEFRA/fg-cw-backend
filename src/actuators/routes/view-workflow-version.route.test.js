import Boom from "@hapi/boom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { asGas, serverFor } from "../../../test/helpers/case-route-server.js";
import { operatorHeaders } from "../../../test/helpers/operator.js";
import { viewWorkflowVersionUseCase } from "../use-cases/view-workflow-version.use-case.js";
import { viewWorkflowVersionRoute } from "./view-workflow-version.route.js";

vi.mock("../use-cases/view-workflow-version.use-case.js");
vi.mock("../../common/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const get = async (url, headers = asGas()) =>
  (await serverFor(viewWorkflowVersionRoute)).inject({
    method: "GET",
    url,
    headers,
  });

const VERSION = {
  version: "2.0.0",
  status: "draft",
  receivedAt: "2026-10-15T10:04:00.000Z",
};

const NOT_STORED = {
  version: { grantCode: "woodland", ...VERSION, fetchStatus: "pending" },
  versions: [VERSION],
  current: null,
  storedBytes: null,
  summary: null,
};

beforeEach(() => {
  viewWorkflowVersionUseCase.mockResolvedValue(NOT_STORED);
});

describe("viewWorkflowVersionRoute", () => {
  it("answers a version that is not stored", async () => {
    const response = await get("/actuators/workflows/woodland/versions/2.0.0");

    expect(response.statusCode).toBe(200);
    expect(response.result).toEqual(NOT_STORED);
    expect(viewWorkflowVersionUseCase).toHaveBeenCalledWith({
      code: "woodland",
      version: "2.0.0",
      include: undefined,
    });
  });

  it("returns the stored document whole, with the endpoints' addresses", async () => {
    const answer = {
      ...NOT_STORED,
      storedBytes: 900,
      summary: {
        schemeName: null,
        requiredRoles: { allOf: [], anyOf: ["ROLE_A"] },
      },
      document: { phases: [{ anything: [1, { deep: true }] }] },
      addresses: [
        { code: "land-parcels", service: "LAND_DATA", url: null },
        { code: "rules", service: "RULES", url: "https://r.example/run" },
      ],
    };
    viewWorkflowVersionUseCase.mockResolvedValue(answer);

    const response = await get(
      "/actuators/workflows/woodland/versions/2.0.0?include=document",
    );

    expect(response.statusCode).toBe(200);
    expect(response.result).toEqual(answer);
    expect(viewWorkflowVersionUseCase).toHaveBeenCalledWith(
      expect.objectContaining({ include: "document" }),
    );
  });

  it.each([
    ["a version that is not x.y.z", "/actuators/workflows/woodland/versions/2"],
    [
      "an include other than document",
      "/actuators/workflows/woodland/versions/2.0.0?include=addresses",
    ],
  ])("answers 400 to %s", async (_, url) => {
    expect((await get(url)).statusCode).toBe(400);
  });

  it("answers 403 to any client but fg-gas-backend", async () => {
    const response = await get("/actuators/workflows/woodland/versions/2.0.0", {
      "x-test-client": "test-client",
      ...operatorHeaders,
    });

    expect(response.statusCode).toBe(403);
  });

  it("answers 500 rather than an answer its schema refuses", async () => {
    viewWorkflowVersionUseCase.mockResolvedValue({
      ...NOT_STORED,
      storedBytes: "big",
    });

    expect(
      (await get("/actuators/workflows/woodland/versions/2.0.0")).statusCode,
    ).toBe(500);
  });

  it("passes the WORKFLOW_VERSION_NOT_FOUND reason through on a 404", async () => {
    const error = Boom.notFound("Workflow version not found");
    error.output.payload.reason = "WORKFLOW_VERSION_NOT_FOUND";
    viewWorkflowVersionUseCase.mockRejectedValue(error);

    const response = await get("/actuators/workflows/woodland/versions/9.9.9");

    expect(response.statusCode).toBe(404);
    expect(response.result.reason).toBe("WORKFLOW_VERSION_NOT_FOUND");
  });
});
