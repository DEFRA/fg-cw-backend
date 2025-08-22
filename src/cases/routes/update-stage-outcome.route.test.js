import hapi from "@hapi/hapi";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { updateStageOutcomeRoute } from "./update-stage-outcome.route.js";

vi.mock("../use-cases/change-case-stage.use-case.js");

describe("changeCaseStageRoute", () => {
  let server;

  beforeAll(async () => {
    server = hapi.server();
    server.route(updateStageOutcomeRoute);
    await server.initialize();
  });

  afterAll(async () => {
    await server.stop();
  });

  it("moves the case to next stage and returns no content", async () => {
    const caseId = "808b8c8f8c8f8c8f8c8f8c8f";

    const { statusCode, result } = await server.inject({
      method: "POST",
      url: `/cases/${caseId}/stage`,
      payload: {},
    });

    expect(statusCode).toEqual(204);

    expect(result).toEqual(null);

    expect(updateStageOutcomeRoute).toHaveBeenCalledWith(caseId);
  });
});
