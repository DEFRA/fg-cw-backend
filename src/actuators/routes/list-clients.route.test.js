import { BSON, Binary, ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { asGas, serverFor } from "../../../test/helpers/case-route-server.js";
import { OPERATOR_ID, OPERATOR_NAME } from "../../../test/helpers/operator.js";
import {
  documentOf,
  objectIdElement,
  stringElement,
} from "../../../test/helpers/raw-bson.js";
import { logger } from "../../common/logger.js";
import { CASE_READER_CLIENT } from "../../common/require-case-reader.js";
import { listApiClientsUseCase } from "../use-cases/list-api-clients.use-case.js";
import { listClientsRoute } from "./list-clients.route.js";

vi.mock("../use-cases/list-api-clients.use-case.js");
vi.mock("../../common/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const CALLER_HASH = "c".repeat(64);
const CALLER_ID = "6650c1f2a9e4b1d07c20bd91";

const STORED = {
  _id: new ObjectId("6650c1f2a9e4b1d07c20bd91"),
  id: "ccc••••••ccc",
  client: CASE_READER_CLIENT,
  tokenHint: "x9Q_",
  expiresAt: null,
  createdAt: new Date("2026-11-02T10:00:00Z"),
  createdBy: "Jane",
};

const base64Of = (row) =>
  BSON.serialize(row, { ignoreUndefined: true }).toString("base64");

const ROW = {
  tokenId: "6650c1f2a9e4b1d07c20bd91",
  clientId: CASE_READER_CLIENT,
  tokenHint: "x9Q_",
  status: "ACTIVE",
  createdAt: "2026-11-02T10:00:00.000Z",
  createdBy: "Jane",
  expiresAt: null,
  revokedAt: null,
  revokedBy: null,
  inUse: true,
  document: base64Of(STORED),
};

const NAMELESS = {
  ...ROW,
  tokenId: "6650c1f2a9e4b1d07c20bd92",
  clientId: null,
  tokenHint: null,
  createdAt: null,
  createdBy: null,
  inUse: false,
  document: base64Of({
    _id: new ObjectId("6650c1f2a9e4b1d07c20bd92"),
    id: "ccc••••••ccc",
    client: "Grants_UI",
    expiresAt: null,
    legacy: 1,
  }),
};

const withStored = (fields) => ({
  ...ROW,
  document: base64Of({ ...STORED, ...fields }),
});

const twiceId = documentOf([
  objectIdElement("_id", STORED._id),
  stringElement("id", "ccc••••••ccc"),
  stringElement("id", CALLER_HASH),
]).toString("base64");

const get = async (headers = asGas({ "x-test-token-id": CALLER_ID })) =>
  (await serverFor(listClientsRoute)).inject({
    method: "GET",
    url: "/actuators/clients",
    headers,
  });

beforeEach(() => {
  listApiClientsUseCase.mockResolvedValue({ tokens: [ROW, NAMELESS] });
});

describe("listClientsRoute", () => {
  it("is a public API GET on /actuators/clients", () => {
    expect(listClientsRoute.method).toBe("GET");
    expect(listClientsRoute.path).toBe("/actuators/clients");
    expect(listClientsRoute.options.auth).toBe("public-api");
  });

  it("answers every token row, passing the caller's token and the operator", async () => {
    const response = await get();

    expect(response.statusCode).toBe(200);
    expect(response.result).toEqual({ tokens: [ROW, NAMELESS] });
    expect(listApiClientsUseCase).toHaveBeenCalledWith({
      callerTokenId: CALLER_ID,
      operator: { id: OPERATOR_ID, name: OPERATOR_NAME },
      caller: CASE_READER_CLIENT,
    });
  });

  it("is never stored by a cache", async () => {
    expect((await get()).headers["cache-control"]).toBe("no-store");
  });

  it("answers 400 without the operator", async () => {
    expect(
      (await get({ "x-test-client": CASE_READER_CLIENT })).statusCode,
    ).toBe(400);
    expect(listApiClientsUseCase).not.toHaveBeenCalled();
  });

  it.each([
    ["the hash", { ...ROW, id: CALLER_HASH }],
    ["seeded", { ...ROW, seeded: true }],
    ["updatedAt", { ...ROW, updatedAt: null }],
    ["no status", { ...ROW, status: undefined }],
    ["an unknown status", { ...ROW, status: "PAUSED" }],
    ["the legacy client value", { ...NAMELESS, client: "Grants_UI" }],
    ["no inUse", { ...ROW, inUse: undefined }],
    ["no stored row", { ...ROW, document: undefined }],
    [
      "the row as relaxed Extended JSON",
      { ...ROW, document: BSON.EJSON.serialize(STORED, { relaxed: true }) },
    ],
    ["an unmasked hash in the stored row", withStored({ id: CALLER_HASH })],
    ["no id in the stored row", withStored({ id: undefined })],
    ["an id not a string", withStored({ id: 7 })],
    ["an _id not an ObjectId", withStored({ _id: STORED._id.toHexString() })],
    ["a hash in another stored field", withStored({ tokenHash: CALLER_HASH })],
    [
      "a hash inside a longer stored value",
      withStored({ note: `was ${CALLER_HASH.toUpperCase()}` }),
    ],
    ["a nested stored value", withStored({ extra: { id: CALLER_HASH } })],
    ["a stored array", withStored({ extra: [CALLER_HASH] })],
    [
      "a stored Binary(32)",
      withStored({ id2: new Binary(Buffer.from(CALLER_HASH, "hex")) }),
    ],
    ["a hash as a stored key", withStored({ [CALLER_HASH]: 1 })],
    ["a second id", { ...ROW, document: twiceId }],
    [
      "bytes that aren't BSON",
      { ...ROW, document: Buffer.from("not bson").toString("base64") },
    ],
  ])(
    "fails closed with a 500 rather than send a row with %s",
    async (_, row) => {
      listApiClientsUseCase.mockResolvedValue({ tokens: [row] });

      const response = await get();

      expect(response.statusCode).toBe(500);
      expect(response.payload).not.toContain(CALLER_HASH);
      expect(JSON.stringify(logger.error.mock.calls)).not.toContain(
        CALLER_HASH,
      );
    },
  );
});
