import { beforeEach, describe, expect, it, vi } from "vitest";
import { logger } from "../../common/logger.js";
import { searchCasesUseCase } from "../use-cases/search-cases.use-case.js";
import { asGas, serverFor } from "../../../test/helpers/case-route-server.js";
import {
  OPERATOR_ID,
  OPERATOR_NAME,
  operatorHeaders,
} from "../../../test/helpers/operator.js";
import { CASE_READER_CLIENT } from "../../common/require-case-reader.js";
import { searchCasesRoute } from "./search-cases.route.js";

vi.mock("../use-cases/search-cases.use-case.js");
vi.mock("../../common/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const PAGE = {
  cases: [],
  pagination: { endCursor: null, hasNextPage: false },
};

const post = async (payload, headers = asGas()) =>
  (await serverFor(searchCasesRoute)).inject({
    method: "POST",
    url: "/actuators/cases/search",
    headers,
    payload,
  });

beforeEach(() => {
  searchCasesUseCase.mockResolvedValue(PAGE);
});

describe("searchCasesRoute", () => {
  it("is a POST on /actuators/cases/search on the public API", () => {
    expect(searchCasesRoute.method).toBe("POST");
    expect(searchCasesRoute.path).toBe("/actuators/cases/search");
    expect(searchCasesRoute.options.auth).toBe("public-api");
    expect(searchCasesRoute.options.tags).toEqual(["api", "public-api"]);
  });

  it("passes the query, the operator, the caller and the repeat flag", async () => {
    const response = await post(
      { ref: "ABC-123", workflowCode: "frps", withTotal: false },
      asGas({ "x-search-repeat": "1" }),
    );

    expect(response.statusCode).toBe(200);
    expect(searchCasesUseCase).toHaveBeenCalledWith({
      query: { ref: "abc-123", workflowCode: "frps", withTotal: false },
      operator: { id: OPERATOR_ID, name: OPERATOR_NAME },
      caller: CASE_READER_CLIENT,
      repeat: true,
    });
  });

  it("takes an empty body as a browse of every case", async () => {
    await post(undefined);

    expect(searchCasesUseCase).toHaveBeenCalledWith(
      expect.objectContaining({ query: {}, repeat: false }),
    );
  });

  it("decodes an RFC 8187 operator name", async () => {
    await post({}, asGas({ "x-actor": "UTF-8''%C5%81ukasz" }));

    expect(searchCasesUseCase).toHaveBeenCalledWith(
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
    expect(searchCasesUseCase).not.toHaveBeenCalled();
  });

  it.each([
    ["no x-actor", { "x-actor": undefined }],
    ["no x-actor-id", { "x-actor-id": undefined }],
    ["an x-actor-id that is not a GUID", { "x-actor-id": "jane" }],
    ["an x-search-repeat other than 1", { "x-search-repeat": "yes" }],
  ])("answers 400 to %s", async (_name, headers) => {
    const response = await post({}, JSON.parse(JSON.stringify(asGas(headers))));

    expect(response.statusCode).toBe(400);
  });

  it.each([
    ["a ref with a cursor", { ref: "abc", cursor: "eyJ9" }],
    [
      "from after to",
      { from: "2026-06-17T00:00:00Z", to: "2026-06-16T00:00:00Z" },
    ],
    ["a date that is not ISO", { from: "yesterday" }],
    ["an sbi", { sbi: "123456789" }],
  ])("answers 400 to %s", async (_name, payload) => {
    expect((await post(payload)).statusCode).toBe(400);
  });

  it("logs a rejected value's path and rule, never the value", async () => {
    await post({ from: "SECRET-VALUE" });

    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain(
      "SECRET-VALUE",
    );
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("from:"));
  });

  it.each([
    ["an answered search", asGas()],
    [
      "a 400 for an oversized x-actor",
      asGas({ "x-actor": `${OPERATOR_NAME}${"x".repeat(2000)}` }),
    ],
  ])("logs no operator name or id on %s", async (_name, headers) => {
    await post({}, headers);

    const logged = JSON.stringify(
      Object.values(logger).flatMap((method) => method.mock.calls),
    );

    expect(logged).not.toContain(OPERATOR_NAME);
    expect(logged).not.toContain(OPERATOR_ID);
  });

  it("answers 400 to an oversized x-actor", async () => {
    expect(
      (await post({}, asGas({ "x-actor": "x".repeat(2000) }))).statusCode,
    ).toBe(400);
  });

  it("answers a 500 rather than a response off its schema", async () => {
    searchCasesUseCase.mockResolvedValue({ cases: "nope" });

    expect((await post({})).statusCode).toBe(500);
  });
});
