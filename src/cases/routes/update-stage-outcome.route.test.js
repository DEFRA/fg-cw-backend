import hapi from "@hapi/hapi";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { updateStageOutcomeUseCase } from "../use-cases/update-stage-outcome.use-case.js";
import { updateStageOutcomeRoute } from "./update-stage-outcome.route.js";

vi.mock("../use-cases/update-stage-outcome.use-case.js");

describe("updateStageOutcomeUseCase", () => {
  let server;

  beforeAll(async () => {
    server = hapi.server();
    server.route(updateStageOutcomeRoute);
    await server.initialize();
  });

  afterAll(async () => {
    await server.stop();
  });

  it("calls the use case with the correct parameters", async () => {
    const caseId = "808b8c8f8c8f8c8f8c8f8c8f";

    const { statusCode, result } = await server.inject({
      method: "PATCH",
      url: `/cases/${caseId}/stage/outcome`,
      payload: {
        actionId: "approve",
        comment: "This is a test comment",
      },
    });

    expect(statusCode).toEqual(204);

    expect(result).toEqual(null);

    expect(updateStageOutcomeUseCase).toHaveBeenCalledWith({
      caseId,
      actionId: "approve",
      comment: "This is a test comment",
    });
  });
});
