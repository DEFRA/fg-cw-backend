import Boom from "@hapi/boom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { logger } from "../../common/logger.js";
import { viewCaseDataUseCase } from "../use-cases/view-case-data.use-case.js";
import { asGas, serverFor } from "../../../test/helpers/case-route-server.js";
import {
  OPERATOR_ID,
  OPERATOR_NAME,
  operatorHeaders,
} from "../../../test/helpers/operator.js";
import { CASE_READER_CLIENT } from "../../common/require-case-reader.js";
import { viewCaseDataRoute } from "./view-case-data.route.js";

vi.mock("../use-cases/view-case-data.use-case.js");
vi.mock("../../common/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const SUMMARY = {
  ref: { caseRef: "ref-1", workflowCode: "frps" },
  position: { phase: "PRE_AWARD", stage: "REVIEW", status: "NEW" },
  closed: false,
  closedAt: null,
  createdAt: "2026-06-16T10:00:00.000Z",
  originalConfigVersion: "1.0.0",
  currentConfigVersion: "1.2.0",
  series: null,
};

const get = async (url, headers = asGas()) =>
  (await serverFor(viewCaseDataRoute)).inject({ method: "GET", url, headers });

beforeEach(() => {
  viewCaseDataUseCase.mockResolvedValue({ case: SUMMARY, storedBytes: 42 });
});

describe("viewCaseDataRoute", () => {
  it("is a GET on /actuators/cases/{workflowCode}/{caseRef}", () => {
    expect(viewCaseDataRoute.method).toBe("GET");
    expect(viewCaseDataRoute.path).toBe(
      "/actuators/cases/{workflowCode}/{caseRef}",
    );
    expect(viewCaseDataRoute.options.auth).toBe("public-api");
  });

  it("passes the key, the include, the operator and the caller", async () => {
    const response = await get("/actuators/cases/frps/ref-1?include=document");

    expect(response.statusCode).toBe(200);
    expect(viewCaseDataUseCase).toHaveBeenCalledWith({
      workflowCode: "frps",
      caseRef: "ref-1",
      include: "document",
      operator: { id: OPERATOR_ID, name: OPERATOR_NAME },
      caller: CASE_READER_CLIENT,
    });
  });

  it("returns the document whole, whatever its shape", async () => {
    const document = { payload: { anything: [1, { deep: true }] } };
    viewCaseDataUseCase.mockResolvedValue({
      case: SUMMARY,
      storedBytes: 42,
      document,
    });

    const response = await get("/actuators/cases/frps/ref-1?include=document");

    expect(response.result.document).toEqual(document);
  });

  it("is never stored by a cache", async () => {
    expect(
      (await get("/actuators/cases/frps/ref-1")).headers["cache-control"],
    ).toBe("no-store");
  });

  it("answers 400 to an include other than document", async () => {
    expect(
      (await get("/actuators/cases/frps/ref-1?include=timeline")).statusCode,
    ).toBe(400);
  });

  it("answers 400 without the operator's id", async () => {
    expect(
      (
        await get("/actuators/cases/frps/ref-1", {
          "x-test-client": CASE_READER_CLIENT,
          "x-actor": OPERATOR_NAME,
        })
      ).statusCode,
    ).toBe(400);
  });

  it("answers 403 to any client but fg-gas-backend", async () => {
    const response = await get("/actuators/cases/frps/ref-1", {
      "x-test-client": "test-client",
      ...operatorHeaders,
    });

    expect(response.statusCode).toBe(403);
    expect(viewCaseDataUseCase).not.toHaveBeenCalled();
  });

  it.each([
    ["an answered read", asGas()],
    [
      "a 400 for an oversized x-actor",
      asGas({ "x-actor": `${OPERATOR_NAME}${"x".repeat(2000)}` }),
    ],
  ])("logs no operator name or id on %s", async (_name, headers) => {
    await get("/actuators/cases/frps/ref-1", headers);

    const logged = JSON.stringify(
      Object.values(logger).flatMap((method) => method.mock.calls),
    );

    expect(logged).not.toContain(OPERATOR_NAME);
    expect(logged).not.toContain(OPERATOR_ID);
  });

  it("passes the CASE_NOT_FOUND reason through on a 404", async () => {
    const error = Boom.notFound("Case not found");
    error.output.payload.reason = "CASE_NOT_FOUND";
    viewCaseDataUseCase.mockRejectedValue(error);

    const response = await get("/actuators/cases/frps/ref-1");

    expect(response.statusCode).toBe(404);
    expect(response.result.reason).toBe("CASE_NOT_FOUND");
  });
});
