import { beforeEach, describe, expect, it, vi } from "vitest";
import { asGas, serverFor } from "../../../test/helpers/case-route-server.js";
import { operatorHeaders } from "../../../test/helpers/operator.js";
import { refuse } from "../../common/buckets/refusal.js";
import { summariseBucketUseCase } from "../use-cases/summarise-bucket.use-case.js";
import { summariseBucketRoute } from "./summarise-bucket.route.js";

vi.mock("../use-cases/summarise-bucket.use-case.js");
vi.mock("../../common/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const ANSWER = {
  bucket: "cw.inbox",
  summary: "errors",
  entries: [
    {
      values: { errorKey: "TimeoutError", eventType: "Sent" },
      count: 3,
      capped: false,
      firstAt: "2026-10-01T08:00:00.000Z",
      lastAt: "2026-10-09T09:14:03.120Z",
    },
    {
      values: { errorKey: null, eventType: null },
      count: 1,
      capped: false,
      firstAt: null,
      lastAt: null,
    },
  ],
  more: false,
  complete: true,
};

const post = async (payload, headers = asGas()) =>
  (await serverFor(summariseBucketRoute)).inject({
    method: "POST",
    url: "/actuators/buckets/cw.inbox/summaries/errors",
    headers,
    payload,
  });

beforeEach(() => {
  summariseBucketUseCase.mockResolvedValue(ANSWER);
});

describe("summariseBucketRoute", () => {
  it("is a POST under the bucket on the public API", () => {
    expect(summariseBucketRoute.method).toBe("POST");
    expect(summariseBucketRoute.path).toBe(
      "/actuators/buckets/{bucketId}/summaries/{summaryId}",
    );
    expect(summariseBucketRoute.options.auth).toBe("public-api");
  });

  it("answers the summary, never to be stored, for the range it was sent", async () => {
    const response = await post({ from: "2026-10-08T12:00:00.000Z" });

    expect(response.statusCode).toBe(200);
    expect(response.result).toEqual(ANSWER);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(summariseBucketUseCase).toHaveBeenCalledExactlyOnceWith({
      bucketId: "cw.inbox",
      summaryId: "errors",
      body: { show: [], from: "2026-10-08T12:00:00.000Z" },
    });
  });

  it("refuses a body with a key it does not know", async () => {
    const response = await post({ where: { status: "FAILED" } });

    expect(response.statusCode).toBe(400);
    expect(response.result.reason).toBe("INVALID_REQUEST");
    expect(summariseBucketUseCase).not.toHaveBeenCalled();
  });

  it("passes a refusal on with its reason", async () => {
    summariseBucketUseCase.mockRejectedValue(refuse("UNKNOWN_SUMMARY"));

    const response = await post();

    expect(response.statusCode).toBe(404);
    expect(response.result.reason).toBe("UNKNOWN_SUMMARY");
  });

  it("refuses a request that names no operator", async () => {
    const response = await post(
      {},
      JSON.parse(JSON.stringify(asGas({ "x-actor": undefined }))),
    );

    expect(response.statusCode).toBe(400);
    expect(summariseBucketUseCase).not.toHaveBeenCalled();
  });

  it("answers 403 to any client but fg-gas-backend", async () => {
    const response = await post(
      {},
      { "x-test-client": "fg-grants-platform-admin", ...operatorHeaders },
    );

    expect(response.statusCode).toBe(403);
    expect(summariseBucketUseCase).not.toHaveBeenCalled();
  });
});
