import { BSON, ObjectId } from "mongodb";
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
  v: 4,
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
    ["a v2 Query", { ...QUERY, v: 2 }],
    ["a v3 Query", { ...QUERY, v: 3 }],
    ["v1's field names", { ...QUERY, columns: [{ field: "ref" }] }],
    ["v1's answers", { ...QUERY, answers: {} }],
    ["an operator as a key", { ...QUERY, where: { $where: SENTINEL } }],
    ["an operator as a path", testOn("$where")],
    ["a lone $ in a path", testOn("payload.$")],
    ["an all-positional path", testOn("phases.$[].code")],
    ["a positional path", testOn("phases.$.code")],
    ["a malformed path", testOn("payload..Sentinel Farm")],
    ["a prototype key in a path", testOn("payload.__proto__.x")],
    [
      "an ObjectId not in lower case hex",
      {
        ...QUERY,
        where: {
          path: "_id",
          op: "eq",
          values: [{ oid: "6741A0C2E4B0F1A2B3C4D5E6" }],
        },
      },
    ],
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
    ["_id in the filter", testOn("_id")],
    ["_id as a column", { ...QUERY, columns: [{ path: "_id" }] }],
    [
      "_id as the sort",
      { ...QUERY, orderBy: { path: "_id", fn: null, desc: true } },
    ],
    [
      "an ObjectId as a value",
      {
        ...QUERY,
        where: {
          path: "_id",
          op: "in",
          values: [
            { oid: "6741a0c2e4b0f1a2b3c4d5e6" },
            { oid: "6741a0c2e4b0f1a2b3c4d5e7" },
          ],
        },
      },
    ],
    [
      "an ObjectId as a range's bound",
      {
        ...QUERY,
        where: {
          path: "_id",
          op: "gte",
          values: [{ oid: "6741a0c2e4b0f1a2b3c4d5e6" }],
        },
      },
    ],
    ["a $ key after the first segment", testOn("payload.answers.$schema")],
    ["a path once denied", testOn("payload.bank.SentinelFarm")],
    ["the timeline", testOn("timeline.createdBy")],
  ])("passes a Query with %s", async (_, payload) => {
    const response = await post(payload);

    expect(response.statusCode).toBe(200);
    expect(exploreQueryUseCase.mock.calls[0][0].query).toEqual(payload);
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

const idOf = (hex) =>
  BSON.serialize({ _id: ObjectId.createFromHexString(hex) }).toString("base64");

const ID = idOf("6741a0c2e4b0f1a2b3c4d5e6");
const OTHER = idOf("6741a0c2e4b0f1a2b3c4d5e7");

const DOCUMENTS = {
  ...QUERY,
  mode: "documents",
  documents: { whole: true, id: true, bytes: 80 },
  rows: [{ box: "cw.cases", id: ID, at: [] }],
};

const docOf = (text) => BSON.serialize({ a: text }).toString("base64");

const fetched = (doc, id = ID) => ({ box: "cw.cases", id, at: [], doc });

describe("exploreQueryRoute's documents fetch", () => {
  it("passes a fetch of 5,000 rows of the longest ids", async () => {
    const rows = Array.from({ length: 5000 }, () => ({
      box: `cw.${"a".repeat(61)}`,
      id: "A".repeat(1400),
      at: [2 ** 31, 2 ** 31, 2 ** 31, 2 ** 31],
    }));

    exploreQueryUseCase.mockResolvedValue({
      documents: rows.map((row, n) => ({
        ...row,
        ...(n === 0 ? { gone: true } : { unread: true }),
      })),
    });

    const response = await post({ ...DOCUMENTS, rows, limit: 5000 });

    expect(response.statusCode).toBe(200);
    expect(exploreQueryUseCase.mock.calls[0][0].query.rows).toHaveLength(5000);
  });

  it.each([
    [
      "with no allowance",
      { ...DOCUMENTS, documents: { whole: true, id: true } },
    ],
    ["with no rows", { ...DOCUMENTS, rows: undefined }],
    [
      "of more rows than an answer holds",
      {
        ...DOCUMENTS,
        rows: Array.from({ length: 5001 }, () => DOCUMENTS.rows[0]),
        limit: 5000,
      },
    ],
    [
      "of more rows than its limit",
      { ...DOCUMENTS, rows: [DOCUMENTS.rows[0], DOCUMENTS.rows[0]], limit: 1 },
    ],
    [
      "from a box id over 64 characters",
      {
        ...DOCUMENTS,
        rows: [{ ...DOCUMENTS.rows[0], box: `cw.${"a".repeat(62)}` }],
      },
    ],
    ["rows outside a fetch", { ...QUERY, rows: DOCUMENTS.rows }],
  ])("refuses a Query asking for documents %s", async (_, payload) => {
    const response = await post(payload);

    expect(response.statusCode).toBe(400);
    expect(response.result.reason).toBe("EXPLORE_QUERY_INVALID");
    expect(exploreQueryUseCase).not.toHaveBeenCalled();
  });

  it("answers the documents it was asked for, within the bytes it may send", async () => {
    const answer = { documents: [fetched(docOf("x".repeat(20)))] };

    exploreQueryUseCase.mockResolvedValue(answer);

    const response = await post(DOCUMENTS);

    expect(response.statusCode).toBe(200);
    expect(response.result).toEqual(answer);
  });

  it("answers a first document larger than the bytes it may send, held whole", async () => {
    const answer = { documents: [fetched(docOf("x".repeat(200)))] };

    exploreQueryUseCase.mockResolvedValue(answer);

    const response = await post({
      ...DOCUMENTS,
      documents: { ...DOCUMENTS.documents, bytes: 1 },
    });

    expect(response.statusCode).toBe(200);
    expect(response.result).toEqual(answer);
  });

  const TWO = {
    ...DOCUMENTS,
    rows: [DOCUMENTS.rows[0], { box: "cw.cases", id: OTHER, at: [] }],
  };
  const small = fetched(docOf("x".repeat(20)));
  const other = fetched(docOf("z".repeat(20)), OTHER);
  const unread = { ...fetched(undefined, OTHER), unread: true };

  it("answers a row let go unread past the bytes it may send", async () => {
    const answer = { documents: [small, unread] };

    exploreQueryUseCase.mockResolvedValue(answer);

    expect((await post(TWO)).result).toEqual(answer);
  });

  it("answers a row too large to make", async () => {
    const answer = {
      documents: [small, { ...fetched(undefined, OTHER), tooLarge: true }],
    };

    exploreQueryUseCase.mockResolvedValue(answer);

    expect((await post(TWO)).result).toEqual(answer);
  });

  it.each([
    [
      "more bytes than it may send",
      [small, fetched(docOf("y".repeat(40)), OTHER)],
    ],
    ["fewer entries than rows asked", [small]],
    ["more entries than rows asked", [small, other, other]],
    ["an entry for another row", [small, { ...other, at: [0] }]],
    ["the rows in another order", [other, small]],
    ["a later note", [small, { ...fetched(undefined, OTHER), later: 10 }]],
    [
      "the first row asked unread",
      [{ ...fetched(undefined), unread: true }, other],
    ],
    ["a document with a note", [small, { ...other, gone: true }]],
    ["a too large row with a document", [small, { ...other, tooLarge: true }]],
    ["a document that isn't BSON", [small, fetched("bm90IGJzb24=", OTHER)]],
  ])("never answers %s", async (_, documents) => {
    exploreQueryUseCase.mockResolvedValue({ documents });

    expect((await post(TWO)).statusCode).toBe(500);
  });

  it("answers one entry for each row asked, in its order", async () => {
    const answer = { documents: [small, other] };

    exploreQueryUseCase.mockResolvedValue(answer);

    expect((await post(TWO)).result).toEqual(answer);
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
