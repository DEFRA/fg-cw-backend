import http from "node:http";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { asGas, serverFor } from "../../../test/helpers/case-route-server.js";
import { OPERATOR_ID, OPERATOR_NAME } from "../../../test/helpers/operator.js";
import { logger } from "../../common/logger.js";
import { CASE_READER_CLIENT } from "../../common/require-case-reader.js";
import { MAX_TIME_MS } from "../explore/limits.js";
import { exploreQueryUseCase } from "../use-cases/explore-query.use-case.js";
import { exploreQueryRoute } from "./explore-query.route.js";

vi.mock("../use-cases/explore-query.use-case.js", async (importOriginal) => ({
  ...(await importOriginal()),
  exploreQueryUseCase: vi.fn(),
}));
vi.mock("../../common/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const SENTINEL = "Sentinel Farm 4417";

const QUERY = {
  v: 2,
  source: "cases",
  mode: "rows",
  columns: [{ path: "caseRef" }],
  where: {
    path: "payload.answers.applicant.business.name",
    op: "regex",
    values: [{ pattern: SENTINEL, flags: "i" }],
  },
  unwind: [],
  groupBy: null,
  orderBy: null,
  limit: 50,
  positions: null,
};

const testOn = (path) => ({
  ...QUERY,
  where: { path, op: "eq", values: [SENTINEL] },
});

const PART = { read: "exact", boxes: [], groups: null };

const asGasWithTime = () => asGas({ "x-explore-time-left-ms": "4500" });

const post = async (payload, headers = asGasWithTime()) =>
  (await serverFor(exploreQueryRoute)).inject({
    method: "POST",
    url: "/actuators/explore/query",
    headers,
    payload,
  });

beforeEach(() => {
  exploreQueryUseCase.mockResolvedValue(PART);
});

describe("exploreQueryRoute", () => {
  it("passes the Query and the operator, and answers its part never to be stored", async () => {
    const response = await post(QUERY);

    expect(response.statusCode).toBe(200);
    expect(response.result).toEqual(PART);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(exploreQueryUseCase).toHaveBeenCalledWith({
      query: QUERY,
      operator: { id: OPERATOR_ID, name: OPERATOR_NAME },
      timeLeftMs: 4500,
      signal: expect.any(AbortSignal),
    });
  });

  it.each([
    ["an unknown version", { ...QUERY, v: 1 }],
    ["v1's field names", { ...QUERY, columns: [{ field: "ref" }] }],
    ["v1's answers", { ...QUERY, answers: {} }],
    ["an operator as a key", { ...QUERY, where: { $where: SENTINEL } }],
    ["an operator in a path", testOn("payload.$where")],
    ["a positional path", testOn("phases.$.code")],
    ["a malformed path", testOn("payload..Sentinel Farm")],
    ["a prototype key in a path", testOn("payload.__proto__.x")],
    ["a denied path", testOn("payload.bank.SentinelFarm")],
    ["an internal path", testOn("_id")],
    [
      "a pattern over 64 characters",
      {
        ...QUERY,
        where: {
          ...QUERY.where,
          values: [{ pattern: SENTINEL.repeat(4), flags: "" }],
        },
      },
    ],
    [
      "an object as a value",
      {
        ...QUERY,
        where: { ...testOn("caseRef").where, values: [{ x: SENTINEL }] },
      },
    ],
    [
      "a value over 200 characters",
      { ...QUERY, where: { ...QUERY.where, values: [SENTINEL.repeat(20)] } },
    ],
  ])(
    "refuses %s as EXPLORE_QUERY_INVALID, logging no value",
    async (_, payload) => {
      const response = await post(payload);

      expect(response.statusCode).toBe(400);
      expect(response.result).toEqual({
        statusCode: 400,
        reason: "EXPLORE_QUERY_INVALID",
      });
      expect(exploreQueryUseCase).not.toHaveBeenCalled();
      expect(JSON.stringify(logger.warn.mock.calls)).not.toContain("Sentinel");
    },
  );

  it.each([
    ["a boolean", true],
    ["null", null],
    ["a date", { date: "2026-11-01" }],
    ["a number", 4.5],
  ])("passes %s as a value", async (_, value) => {
    const response = await post({
      ...QUERY,
      where: { path: "closed", op: "eq", values: [value] },
    });

    expect(response.statusCode).toBe(200);
  });

  it.each([
    ["no time left", asGas()],
    [
      "more time left than Caseworking ever reads for",
      asGas({ "x-explore-time-left-ms": String(MAX_TIME_MS + 1) }),
    ],
  ])("refuses a request that says %s", async (_, headers) => {
    const response = await post(QUERY, headers);

    expect(response.statusCode).toBe(400);
    expect(response.result.reason).toBe("EXPLORE_QUERY_INVALID");
    expect(exploreQueryUseCase).not.toHaveBeenCalled();
  });

  it("refuses a request that names no operator", async () => {
    const response = await post(QUERY, { "x-test-client": CASE_READER_CLIENT });

    expect(response.statusCode).toBe(400);
  });
});

describe("exploreQueryRoute over a real socket", () => {
  let live;

  beforeAll(async () => {
    live = await serverFor(exploreQueryRoute);
    live.settings.port = 0;
    await live.start();
  });

  afterAll(() => live.stop());

  it("stops the part when GAS drops the connection after sending the query", async () => {
    let stoppedAt = null;

    exploreQueryUseCase.mockImplementation(
      ({ signal }) =>
        new Promise((resolve) => {
          signal.addEventListener("abort", () => {
            stoppedAt = Date.now();
            resolve(PART);
          });
        }),
    );

    const request = http.request({
      host: "127.0.0.1",
      port: live.info.port,
      method: "POST",
      path: "/actuators/explore/query",
      headers: { ...asGasWithTime(), "content-type": "application/json" },
    });

    request.on("error", () => {});
    request.end(JSON.stringify(QUERY));
    await vi.waitFor(() => expect(exploreQueryUseCase).toHaveBeenCalled());

    const droppedAt = Date.now();

    request.destroy();
    await vi.waitFor(() => expect(stoppedAt).not.toBeNull());

    expect(stoppedAt - droppedAt).toBeLessThan(200);
  });
});
