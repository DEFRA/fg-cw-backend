import { beforeEach, describe, expect, it, vi } from "vitest";
import { asGas, serverFor } from "../../../test/helpers/case-route-server.js";
import { refuse } from "../../common/buckets/refusal.js";
import { countDeadLettersUseCase } from "../use-cases/count-dead-letters.use-case.js";
import { countDeadLettersRoute } from "./count-dead-letters.route.js";

vi.mock("../use-cases/count-dead-letters.use-case.js");
vi.mock("../../common/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const FROM = "2026-10-08T12:00:00.000Z";
const TO = "2026-10-09T12:00:00.000Z";

const ANSWER = {
  from: FROM,
  to: TO,
  countCap: 10_000,
  buckets: [
    {
      id: "cw.outbox",
      list: { path: "events/cw/outbox", query: { status: "DEAD_LETTER" } },
      bins: [{ from: FROM, to: TO, count: 3, capped: false }],
    },
  ],
};

const get = async (query, headers = asGas()) =>
  (await serverFor(countDeadLettersRoute)).inject({
    method: "GET",
    url: `/actuators/dead-letters?${new URLSearchParams(query)}`,
    headers,
  });

beforeEach(() => {
  countDeadLettersUseCase.mockResolvedValue(ANSWER);
});

describe("countDeadLettersRoute", () => {
  it("is a GET on /actuators/dead-letters on the public API", () => {
    expect(countDeadLettersRoute.method).toBe("GET");
    expect(countDeadLettersRoute.path).toBe("/actuators/dead-letters");
    expect(countDeadLettersRoute.options.auth).toBe("public-api");
  });

  it("answers the counts, never to be stored, for the window it was sent", async () => {
    const response = await get({ from: FROM, to: TO });

    expect(response.statusCode).toBe(200);
    expect(response.result).toEqual(ANSWER);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(countDeadLettersUseCase).toHaveBeenCalledExactlyOnceWith({
      from: FROM,
      to: TO,
    });
  });

  it.each([
    ["no window", {}],
    ["a window without its end", { from: FROM }],
    ["a time that is not one", { from: "yesterday", to: TO }],
    ["a key it does not know", { from: FROM, to: TO, status: "FAILED" }],
  ])("refuses %s", async (_, query) => {
    const response = await get(query);

    expect(response.statusCode).toBe(400);
    expect(response.result.reason).toBe("INVALID_REQUEST");
    expect(countDeadLettersUseCase).not.toHaveBeenCalled();
  });

  it("refuses a window that ends before it starts", async () => {
    const response = await get({ from: TO, to: FROM });

    expect(response.statusCode).toBe(400);
    expect(response.result.reason).toBe("INVALID_RANGE");
    expect(countDeadLettersUseCase).not.toHaveBeenCalled();
  });

  it("refuses a window longer than a week", async () => {
    const response = await get({
      from: "2026-10-01T12:00:00.000Z",
      to: "2026-10-08T12:00:00.001Z",
    });

    expect(response.statusCode).toBe(400);
    expect(response.result.reason).toBe("INVALID_REQUEST");
  });

  it("passes a read that ran out of time on with its reason", async () => {
    countDeadLettersUseCase.mockRejectedValue(refuse("TIMED_OUT"));

    const response = await get({ from: FROM, to: TO });

    expect(response.statusCode).toBe(504);
    expect(response.result.reason).toBe("TIMED_OUT");
  });

  it("refuses a request that names no operator", async () => {
    const response = await get(
      { from: FROM, to: TO },
      JSON.parse(JSON.stringify(asGas({ "x-actor": undefined }))),
    );

    expect(response.statusCode).toBe(400);
    expect(countDeadLettersUseCase).not.toHaveBeenCalled();
  });
});
