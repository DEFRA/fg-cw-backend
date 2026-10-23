import { beforeEach, describe, expect, it, vi } from "vitest";
import { logger } from "../../common/logger.js";
import { queryBucketUseCase } from "../use-cases/query-bucket.use-case.js";
import { asGas, serverFor } from "../../../test/helpers/case-route-server.js";
import {
  OPERATOR_ID,
  OPERATOR_NAME,
  operatorHeaders,
} from "../../../test/helpers/operator.js";
import { refuse } from "../../common/buckets/refusal.js";
import { toConfigLink } from "../../events/case-refs.js";
import { CASE_READER_CLIENT } from "../../common/require-case-reader.js";
import { queryBucketRoute } from "./query-bucket.route.js";

vi.mock("../use-cases/query-bucket.use-case.js");
vi.mock("../../common/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const PAGE = {
  bucket: "cw.cases",
  plan: {
    kind: "exact",
    index: ["createdAt", "_id"],
    bound: [],
    filled: [],
    residual: [],
    scans: 1,
  },
  rows: [
    {
      id: "66f000000000000000000001",
      time: "2026-10-09T09:14:03.120Z",
      title: "abc-123",
      subtitle: null,
      cells: {
        workflowCode: "example-workflow",
        position: { phase: "P", stage: "S", status: "T" },
        closedAt: null,
      },
      link: {
        kind: "case",
        workflowCode: "example-workflow",
        caseRef: "abc-123",
      },
    },
  ],
  page: { next: null, keepLooking: null, searchedTo: null, complete: true },
  groups: [],
};

const EMPTY_QUERY = {
  where: {},
  show: [],
  limit: 20,
  groupBy: [],
};

const post = async (payload, headers = asGas(), bucketId = "cw.cases") =>
  (await serverFor(queryBucketRoute)).inject({
    method: "POST",
    url: `/actuators/buckets/${bucketId}/query`,
    headers,
    payload,
  });

beforeEach(() => {
  queryBucketUseCase.mockResolvedValue(PAGE);
});

describe("queryBucketRoute", () => {
  it("is a POST on /actuators/buckets/{bucketId}/query on the public API", () => {
    expect(queryBucketRoute.method).toBe("POST");
    expect(queryBucketRoute.path).toBe("/actuators/buckets/{bucketId}/query");
    expect(queryBucketRoute.options.auth).toBe("public-api");
    expect(queryBucketRoute.options.tags).toEqual(["api", "public-api"]);
  });

  it("passes the bucket, the validated body, the operator, the caller and the repeat flag", async () => {
    const response = await post(
      { where: { workflowCode: "example-workflow" }, ref: "ref:ABC-123" },
      asGas({ "x-search-repeat": "1" }),
    );

    expect(response.statusCode).toBe(200);
    expect(response.result).toEqual(PAGE);
    expect(queryBucketUseCase).toHaveBeenCalledWith({
      bucketId: "cw.cases",
      body: {
        ...EMPTY_QUERY,
        where: { workflowCode: "example-workflow" },
        ref: "ref:ABC-123",
      },
      operator: { id: OPERATOR_ID, name: OPERATOR_NAME },
      caller: CASE_READER_CLIENT,
      repeat: true,
    });
  });

  it("passes on the config link of a 64-character workflow code", async () => {
    const ref = toConfigLink("W".repeat(64), "1.0.0");

    const response = await post({ ref }, asGas(), "cw.inbox");

    expect(response.statusCode).toBe(200);
    expect(queryBucketUseCase).toHaveBeenCalledWith(
      expect.objectContaining({
        bucketId: "cw.inbox",
        body: { ...EMPTY_QUERY, ref },
      }),
    );
  });

  it("takes no body as the empty query", async () => {
    await post(undefined);

    expect(queryBucketUseCase).toHaveBeenCalledWith(
      expect.objectContaining({ body: EMPTY_QUERY, repeat: false }),
    );
  });

  it("hands a malformed bucket id to the use case rather than refusing it itself", async () => {
    await post({}, asGas(), "CW.Cases");

    expect(queryBucketUseCase).toHaveBeenCalledWith(
      expect.objectContaining({ bucketId: "CW.Cases" }),
    );
  });

  it("decodes an RFC 8187 operator name", async () => {
    await post({}, asGas({ "x-actor": "UTF-8''%C5%81ukasz" }));

    expect(queryBucketUseCase).toHaveBeenCalledWith(
      expect.objectContaining({
        operator: { id: OPERATOR_ID, name: "Łukasz" },
      }),
    );
  });

  it("is never stored by a cache", async () => {
    expect((await post({})).headers["cache-control"]).toBe("no-store");
  });

  it("answers 403 to any client but fg-gas-backend", async () => {
    const response = await post(
      {},
      { "x-test-client": "fg-grants-platform-admin", ...operatorHeaders },
    );

    expect(response.statusCode).toBe(403);
    expect(queryBucketUseCase).not.toHaveBeenCalled();
  });

  it.each([
    ["no x-actor", { "x-actor": undefined }],
    ["no x-actor-id", { "x-actor-id": undefined }],
    ["an x-actor-id that is not a GUID", { "x-actor-id": "jane" }],
    ["an x-search-repeat other than 1", { "x-search-repeat": "yes" }],
  ])("refuses INVALID_REQUEST for %s", async (_name, headers) => {
    const response = await post({}, JSON.parse(JSON.stringify(asGas(headers))));

    expect(response.statusCode).toBe(400);
    expect(response.result.reason).toBe("INVALID_REQUEST");
  });

  it.each([
    ["a free-text search", { q: "abc" }],
    ["a prefix search", { prefix: "abc" }],
    ["a date that is not ISO", { from: "yesterday" }],
    ["a page above the largest", { limit: 101 }],
    ["more groupings than a page draws", { groupBy: ["a", "b", "c", "d"] }],
    ["a filter value that is an object", { where: { closed: { $ne: true } } }],
  ])("refuses INVALID_REQUEST for %s", async (_name, payload) => {
    const response = await post(payload);

    expect(response.statusCode).toBe(400);
    expect(response.result).toEqual({
      statusCode: 400,
      error: "Bad Request",
      message: "The request is not a bucket query",
      reason: "INVALID_REQUEST",
    });
    expect(queryBucketUseCase).not.toHaveBeenCalled();
  });

  it("answers the use case's refusal with its reason", async () => {
    queryBucketUseCase.mockRejectedValue(refuse("UNKNOWN_BUCKET"));

    const response = await post({}, asGas(), "cw.nothing");

    expect(response.statusCode).toBe(404);
    expect(response.result).toEqual({
      statusCode: 404,
      error: "Not Found",
      message: "No such bucket",
      reason: "UNKNOWN_BUCKET",
    });
  });

  it("logs a rejected value's path and rule, never the value", async () => {
    await post({ from: "SECRET-VALUE" });

    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain(
      "SECRET-VALUE",
    );
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("from:"));
  });

  it("logs no operator name or id", async () => {
    await post({});

    const logged = JSON.stringify(
      Object.values(logger).flatMap((method) => method.mock.calls),
    );

    expect(logged).not.toContain(OPERATOR_NAME);
    expect(logged).not.toContain(OPERATOR_ID);
  });

  it("answers a 500 rather than a response off its schema", async () => {
    queryBucketUseCase.mockResolvedValue({ ...PAGE, rows: "nope" });

    expect((await post({})).statusCode).toBe(500);
  });
});
