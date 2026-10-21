import { beforeEach, describe, expect, it, vi } from "vitest";
import { asGas, serverFor } from "../../../test/helpers/case-route-server.js";
import { operatorHeaders } from "../../../test/helpers/operator.js";
import { readTimelineUseCase } from "../use-cases/read-timeline.use-case.js";
import { readTimelineRoute } from "./read-timeline.route.js";

vi.mock("../use-cases/read-timeline.use-case.js");
vi.mock("../../common/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const TIMELINE = {
  buckets: [
    {
      id: "cw.outbox",
      label: "CW outbox",
      rows: [
        {
          id: "66f000000000000000000001",
          time: "2026-10-09T09:14:03.120Z",
          title: "case.status.updated",
          subtitle: "0b7c1d1e-0000-4000-8000-000000000001",
          cells: { status: "COMPLETED", completedAt: null },
          link: {
            kind: "event",
            service: "caseworking",
            box: "outbox",
            id: "66f000000000000000000001",
          },
        },
      ],
      more: false,
    },
    { id: "cw.inbox", label: "CW inbox", rows: null, more: false },
  ],
};

const post = async (payload, headers = asGas()) =>
  (await serverFor(readTimelineRoute)).inject({
    method: "POST",
    url: "/actuators/timeline",
    headers,
    payload,
  });

beforeEach(() => {
  readTimelineUseCase.mockResolvedValue(TIMELINE);
});

describe("readTimelineRoute", () => {
  it("is a POST on /actuators/timeline on the public API", () => {
    expect(readTimelineRoute.method).toBe("POST");
    expect(readTimelineRoute.path).toBe("/actuators/timeline");
    expect(readTimelineRoute.options.auth).toBe("public-api");
  });

  it("answers the timeline, never to be stored, for the ref it was sent", async () => {
    const response = await post({ ref: "ref:abc-123" });

    expect(response.statusCode).toBe(200);
    expect(response.result).toEqual(TIMELINE);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(readTimelineUseCase).toHaveBeenCalledExactlyOnceWith({
      ref: "ref:abc-123",
    });
  });

  it.each([
    ["no ref", {}],
    ["a key it does not know", { ref: "ref:abc-123", limit: 10 }],
  ])("refuses a body with %s", async (_, payload) => {
    const response = await post(payload);

    expect(response.statusCode).toBe(400);
    expect(response.result.reason).toBe("INVALID_REQUEST");
    expect(readTimelineUseCase).not.toHaveBeenCalled();
  });

  it("refuses a request that names no operator", async () => {
    const response = await post(
      { ref: "ref:abc-123" },
      JSON.parse(JSON.stringify(asGas({ "x-actor": undefined }))),
    );

    expect(response.statusCode).toBe(400);
    expect(response.result.reason).toBe("INVALID_REQUEST");
    expect(readTimelineUseCase).not.toHaveBeenCalled();
  });

  it("answers 403 to any client but fg-gas-backend", async () => {
    const response = await post(
      { ref: "ref:abc-123" },
      { "x-test-client": "fg-grants-platform-admin", ...operatorHeaders },
    );

    expect(response.statusCode).toBe(403);
    expect(readTimelineUseCase).not.toHaveBeenCalled();
  });
});
