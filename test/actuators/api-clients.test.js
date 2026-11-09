import { MongoClient, ObjectId } from "mongodb";
import { randomBytes } from "node:crypto";
import { env } from "node:process";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { endOfUkDay } from "../../src/common/date-helpers.js";
import { hashToken } from "../../src/server/plugins/auth/hash-token.js";
import { seedCaseReaderToken } from "../helpers/actuators.js";
import { OPERATOR_NAME, operatorHeaders } from "../helpers/operator.js";
import {
  CASE_READER_CLIENT,
  CASE_READER_TOKEN,
} from "../helpers/service-token.js";
import { wreck } from "../helpers/wreck.js";

const AS_GAS = `Bearer ${CASE_READER_TOKEN}`;
const CALLER_HASH = hashToken(CASE_READER_TOKEN);
const UNKNOWN_USER = "00000000-0000-0000-0000-000000000000";

let client;
let accessTokens;
let outbox;
let namelessIds = [];

const newToken = () => {
  const raw = randomBytes(32).toString("base64url");

  return { raw, hash: hashToken(raw), hint: raw.slice(-4) };
};

const aName = () => `it-${new ObjectId().toHexString().slice(-12)}`;

const send = (method, path, { token = AS_GAS, payload } = {}) =>
  wreck[method](path, {
    headers: { authorization: token, ...operatorHeaders },
    payload,
  });

const call = async (method, path, options) => {
  try {
    const { res, payload } = await send(method, path, options);

    return { statusCode: res.statusCode, body: payload };
  } catch (error) {
    return { statusCode: error.output.statusCode, body: error.data?.payload };
  }
};

const issue = (clientId, { hash, hint }, newClient = false, expiresAt) =>
  call("post", `/actuators/clients/${clientId}/tokens`, {
    payload: { tokenHash: hash, tokenHint: hint, newClient, expiresAt },
  });

const revoke = (clientId, tokenId, token) =>
  call("post", `/actuators/clients/${clientId}/tokens/${tokenId}/revoke`, {
    token,
  });

const list = () => call("get", "/actuators/clients");

const removeToken = ({ clientId, tokenId }) =>
  call("delete", `/actuators/clients/${clientId}/tokens/${tokenId}`);

const changeExpiry = ({ clientId, tokenId }, expiresAt) =>
  call("put", `/actuators/clients/${clientId}/tokens/${tokenId}/expiry`, {
    payload: { expiresAt },
  });

const rotate = ({ clientId, tokenId }, { hash, hint }, keepOld) =>
  call("post", `/actuators/clients/${clientId}/tokens/${tokenId}/rotate`, {
    payload: { tokenHash: hash, tokenHint: hint, keepOld },
  });

const rowsOf = async (clientId) =>
  (await list()).body.tokens.filter((row) => row.clientId === clientId);

const rowFor = async (tokenId) =>
  (await list()).body.tokens.find((row) => row.tokenId === tokenId);

const userRoles = (raw) =>
  call("get", `/api/users/${UNKNOWN_USER}/roles`, { token: `Bearer ${raw}` });

const stored = (tokenId) =>
  accessTokens.findOne({ _id: new ObjectId(tokenId) });

const auditsOf = (entityid, action) =>
  outbox
    .find({
      "event.audit.entities.entityid": entityid,
      "event.audit.entities.action": action,
    })
    .toArray();

const createClient = async () => {
  const clientId = aName();
  const token = newToken();
  const { statusCode, body } = await issue(clientId, token, true);

  expect(statusCode).toBe(201);

  return { clientId, ...token, tokenId: body.token.tokenId };
};

const callerTokenId = async () =>
  (await accessTokens.findOne({ id: CALLER_HASH }))._id.toHexString();

beforeAll(async () => {
  client = await MongoClient.connect(env.MONGO_URI);
  accessTokens = client.db().collection("access_tokens");
  outbox = client.db().collection("outbox");
  await seedCaseReaderToken(client.db());
});

afterEach(async () => {
  await accessTokens.deleteMany({ client: { $regex: /^it-/ } });
  await accessTokens.deleteMany({
    client: CASE_READER_CLIENT,
    id: { $ne: CALLER_HASH },
  });
  await accessTokens.deleteMany({ _id: { $in: namelessIds } });
  namelessIds = [];
});

afterAll(async () => {
  await client?.close(true);
});

const insertNameless = async (row) => {
  const _id = new ObjectId();
  await accessTokens.insertOne({
    _id,
    id: newToken().hash,
    expiresAt: null,
    ...row,
  });
  namelessIds.push(_id);

  return _id.toHexString();
};

describe("GET /actuators/clients", () => {
  it("lists who created and revoked a token, and its hint", async () => {
    const created = await createClient();

    await revoke(created.clientId, created.tokenId);

    const row = await rowFor(created.tokenId);
    const doc = await stored(created.tokenId);

    expect(row).toEqual({
      tokenId: created.tokenId,
      clientId: created.clientId,
      tokenHint: created.hint,
      status: "REVOKED",
      createdAt: expect.any(String),
      createdBy: OPERATOR_NAME,
      expiresAt: row.revokedAt,
      revokedAt: expect.any(String),
      revokedBy: OPERATOR_NAME,
      inUse: false,
      stored: {
        _id: { $oid: created.tokenId },
        id: `${doc.id.slice(0, 3)}••••••${doc.id.slice(-3)}`,
        client: created.clientId,
        tokenHint: created.hint,
        expiresAt: { $date: expect.any(String) },
        createdAt: { $date: expect.any(String) },
        createdBy: OPERATOR_NAME,
        revokedAt: { $date: expect.any(String) },
        revokedBy: OPERATOR_NAME,
      },
    });
    expect(Date.parse(row.stored.revokedAt.$date)).toBe(
      Date.parse(row.revokedAt),
    );

    expect(doc).not.toHaveProperty("updatedAt");
    expect(doc).not.toHaveProperty("seeded");
  });

  it("is the only row marked in use, revoked ones included", async () => {
    const { body } = await issue(CASE_READER_CLIENT, newToken());
    await revoke(CASE_READER_CLIENT, body.token.tokenId);
    await issue(CASE_READER_CLIENT, newToken());
    const created = await createClient();

    const { statusCode, body: view } = await list();

    expect(statusCode).toBe(200);
    expect(
      view.tokens.filter(({ inUse }) => inUse).map(({ tokenId }) => tokenId),
    ).toEqual([await callerTokenId()]);
    expect((await rowFor(created.tokenId)).inUse).toBe(false);
  });

  it("audits the list against this service", async () => {
    await list();

    const [audit] = await auditsOf("fg-cw-backend", "VIEW_API_CLIENT");

    expect(audit.event.audit.status).toBe("success");
    expect(audit.event.audit.details.client.actor).toBe(OPERATOR_NAME);
  });

  it("lists each with no client, its stored name only in the stored row", async () => {
    const blank = await insertNameless({ client: "  " });
    const absent = await insertNameless({});
    const invalid = await insertNameless({ client: "Grants_UI" });

    const { body } = await list();
    const rows = body.tokens.filter(({ tokenId }) =>
      [blank, absent, invalid].includes(tokenId),
    );

    expect(rows.map(({ clientId }) => clientId)).toEqual([null, null, null]);
    expect(rows.map(({ stored }) => stored.client)).toEqual([
      "  ",
      undefined,
      "Grants_UI",
    ]);
  });

  it("never answers a whole hash, only each one's first and last 3 characters", async () => {
    await createClient();

    const { body } = await list();

    expect(JSON.stringify(body)).not.toContain(CALLER_HASH);
    expect(JSON.stringify(body)).not.toMatch(/[0-9a-f]{64}/);
    expect(
      body.tokens.every(({ stored }) =>
        /^[0-9a-f]{3}•{6}[0-9a-f]{3}$/.test(stored.id),
      ),
    ).toBe(true);
  });
});

describe("POST /actuators/clients/{clientId}/tokens", () => {
  it("answers the new token as ACTIVE", async () => {
    const { body } = await issue(aName(), newToken(), true);

    expect(body.token.status).toBe("ACTIVE");
  });

  it.each([
    ["a date", "2999-01-01T00:00:00.000Z"],
    ["never", null],
  ])("issues a token expiring at %s", async (_, expiresAt) => {
    const { body } = await issue(aName(), newToken(), true, expiresAt);

    expect(body.token).toMatchObject({ status: "ACTIVE", expiresAt });
  });

  it.each([
    ["that has passed", "2020-01-01T00:00:00.000Z"],
    ["after 9999", "+010000-01-01T00:00:00.000Z"],
  ])("refuses an expiry %s", async (_, expiresAt) => {
    const refused = await issue(aName(), newToken(), true, expiresAt);

    expect(refused.statusCode).toBe(400);
    expect(refused.body.errorCode).toBe("API_TOKEN_INVALID_EXPIRY");
  });

  it("issues a client any number of active tokens", async () => {
    const created = await createClient();

    for (const token of [newToken(), newToken(), newToken()]) {
      expect((await issue(created.clientId, token)).statusCode).toBe(201);
    }

    expect(await rowsOf(created.clientId)).toHaveLength(4);
  });

  it("refuses to create a client that exists, even with only a revoked token", async () => {
    const created = await createClient();
    await revoke(created.clientId, created.tokenId);

    const again = await issue(created.clientId, newToken(), true);

    expect(again.statusCode).toBe(409);
    expect(again.body.errorCode).toBe("API_CLIENT_EXISTS");
  });

  it("refuses to issue for a client that does not exist", async () => {
    const unknown = await issue(aName(), newToken());

    expect(unknown.statusCode).toBe(404);
    expect(unknown.body.errorCode).toBe("API_CLIENT_NOT_FOUND");
  });

  // A refusal of a malformed name, hash or hint is the model's, so it is
  // audited like any other.
  it.each([
    [
      "a name that fails the rule",
      "IT_Bad_Name",
      { hint: "abcd" },
      "API_CLIENT_INVALID_NAME",
    ],
    [
      "a malformed hash",
      null,
      { hash: "not-a-hash" },
      "API_TOKEN_INVALID_HASH",
    ],
    ["a malformed hint", null, { hint: "ab" }, "API_TOKEN_INVALID_HINT"],
  ])(
    "audits a refusal of %s as a failure",
    async (_, name, fields, errorCode) => {
      const clientId = name ?? aName();

      const refused = await issue(clientId, { ...newToken(), ...fields }, true);

      expect(refused.statusCode).toBe(400);
      expect(refused.body.errorCode).toBe(errorCode);

      const [failure] = await auditsOf(clientId, "ISSUE_API_TOKEN");

      expect(failure.event.audit.status).toBe("failure");
      expect(failure.event.audit.details.client.errorCode).toBe(errorCode);
    },
  );

  it("refuses a repeated hash with a plain 409, quoting it nowhere", async () => {
    const created = await createClient();

    const repeat = await issue(aName(), created, true);

    expect(repeat.statusCode).toBe(409);
    expect(repeat.body.errorCode).toBe("API_TOKEN_DUPLICATE");
    expect(JSON.stringify(repeat.body)).not.toContain(created.hash);
  });

  it("refuses a hint that is not four base64url characters", async () => {
    const refused = await issue(aName(), { ...newToken(), hint: "abc" }, true);

    expect(refused.statusCode).toBe(400);
    expect(refused.body.errorCode).toBe("API_TOKEN_INVALID_HINT");
  });

  it("cannot be issued to under its invalid name", async () => {
    const refused = await issue("Grants_UI", newToken());

    expect(refused.statusCode).toBe(400);
    expect(refused.body.errorCode).toBe("API_CLIENT_INVALID_NAME");
  });
});

describe("POST /actuators/clients/{clientId}/tokens/{tokenId}/revoke", () => {
  it("is refused, audited as a failure and left alone, even beside another active token", async () => {
    expect((await issue(CASE_READER_CLIENT, newToken())).statusCode).toBe(201);

    const callerId = await callerTokenId();
    const before = await stored(callerId);

    const refused = await revoke(CASE_READER_CLIENT, callerId);

    expect(refused.statusCode).toBe(409);
    expect(refused.body.errorCode).toBe("API_TOKEN_IN_USE");
    expect(await stored(callerId)).toEqual(before);

    const [failure] = await auditsOf(CASE_READER_CLIENT, "REVOKE_API_TOKEN");

    expect(failure.event.audit.status).toBe("failure");
    expect(failure.event.audit.details.client).toMatchObject({
      tokenId: callerId,
      errorCode: "API_TOKEN_IN_USE",
    });
    expect(JSON.stringify(failure)).not.toContain(CALLER_HASH);
  });

  it("does not stop the platform client's other token being revoked", async () => {
    const { body } = await issue(CASE_READER_CLIENT, newToken());

    expect(
      (await revoke(CASE_READER_CLIENT, body.token.tokenId)).statusCode,
    ).toBe(204);
    expect((await list()).statusCode).toBe(200);
  });

  it("refuses to revoke a token twice", async () => {
    const created = await createClient();
    await revoke(created.clientId, created.tokenId);
    const revokedRow = await stored(created.tokenId);

    const again = await revoke(created.clientId, created.tokenId);

    expect(again.statusCode).toBe(409);
    expect(again.body.errorCode).toBe("API_TOKEN_NOT_ACTIVE");
    expect(await stored(created.tokenId)).toEqual(revokedRow);
  });

  it.each([
    [{}, CASE_READER_CLIENT],
    [{ client: "Grants_UI" }, "grants-ui"],
    [{ client: "Grants_UI" }, "Grants_UI"],
  ])(
    "never revokes a row with no valid name (%o under %s)",
    async (row, name) => {
      const tokenId = await insertNameless(row);
      const before = await stored(tokenId);

      const revoked = await revoke(name, tokenId);

      expect(revoked.statusCode).toBe(404);
      expect(revoked.body.errorCode).toBe("API_TOKEN_NOT_FOUND");
      expect(await stored(tokenId)).toEqual(before);
    },
  );
});

describe("PUT /actuators/clients/{clientId}/tokens/{tokenId}/expiry", () => {
  const LATER = "2999-01-01T00:00:00.000Z";

  it.each([
    ["an active token", async () => {}],
    [
      "an expired token",
      async ({ tokenId }) =>
        accessTokens.updateOne(
          { _id: new ObjectId(tokenId) },
          { $set: { expiresAt: new Date("2026-01-01T00:00:00.000Z") } },
        ),
    ],
  ])("sets the expiry of %s", async (_, arrange) => {
    const created = await createClient();
    await arrange(created);

    const changed = await changeExpiry(created, LATER);

    expect(changed.statusCode).toBe(200);
    expect(changed.body.revived).toBe(false);
    expect(changed.body.token).toMatchObject({
      tokenId: created.tokenId,
      status: "ACTIVE",
      expiresAt: LATER,
    });
    expect((await userRoles(created.raw)).statusCode).toBe(200);
  });

  it("revives a revoked token, which auth then accepts again", async () => {
    const created = await createClient();
    await revoke(created.clientId, created.tokenId);
    expect((await userRoles(created.raw)).statusCode).toBe(401);

    const changed = await changeExpiry(created, null);
    const revokedAt = (await stored(created.tokenId)).revokedAt;

    expect(revokedAt).toBeNull();
    expect(changed.body.previousExpiresAt).toEqual(expect.any(String));
    expect(changed.body.revived).toBe(true);
    expect(changed.body.token).toMatchObject({
      status: "ACTIVE",
      expiresAt: null,
      revokedAt: null,
      revokedBy: null,
    });
    expect((await userRoles(created.raw)).statusCode).toBe(200);

    const [audit] = await auditsOf(created.clientId, "CHANGE_API_TOKEN_EXPIRY");

    const { expiry } = audit.event.audit.details.client;

    expect(expiry.revived).toBe(true);
    expect(expiry.next ?? null).toBeNull();
    expect(JSON.stringify(audit)).not.toContain(created.hash);
    expect(JSON.stringify(audit)).not.toContain(`"${created.hint}"`);
  });

  it.each([
    ["that has passed", "2020-01-01T00:00:00.000Z"],
    ["after 9999", "+010000-01-01T00:00:00.000Z"],
  ])("refuses an expiry %s", async (_, expiresAt) => {
    const created = await createClient();

    const refused = await changeExpiry(created, expiresAt);

    expect(refused.statusCode).toBe(400);
    expect(refused.body.errorCode).toBe("API_TOKEN_INVALID_EXPIRY");
  });

  it("refuses to end the token the request is made with", async () => {
    const refused = await changeExpiry(
      { clientId: CASE_READER_CLIENT, tokenId: await callerTokenId() },
      "2020-01-01T00:00:00.000Z",
    );

    expect(refused.statusCode).toBe(409);
    expect(refused.body.errorCode).toBe("API_TOKEN_IN_USE");
    expect((await list()).statusCode).toBe(200);
  });
});

describe("POST /actuators/clients/{clientId}/tokens/{tokenId}/rotate", () => {
  const HOUR = 60 * 60 * 1000;

  const overlapEnd = (overlap) => (at) =>
    overlap === 0 ? at : endOfUkDay(new Date(at + overlap)).getTime();

  it.each([
    ["none", overlapEnd(0)],
    ["24h", overlapEnd(24 * HOUR)],
    ["7d", overlapEnd(7 * 24 * HOUR)],
  ])(
    "rotates with keepOld %s, the new token copying the old expiry",
    async (keepOld, endFrom) => {
      const expiresAt = "2999-01-01T00:00:00.000Z";
      const created = await createClient();
      await changeExpiry(created, expiresAt);
      const next = newToken();
      const before = Date.now();

      const rotated = await rotate(created, next, keepOld);

      expect(rotated.statusCode).toBe(201);
      expect(rotated.body.token).toMatchObject({
        clientId: created.clientId,
        tokenHint: next.hint,
        status: "ACTIVE",
        expiresAt,
        createdBy: OPERATOR_NAME,
      });
      expect((await userRoles(next.raw)).statusCode).toBe(200);

      const old = await stored(created.tokenId);

      expect(rotated.body.oldExpiresAt).toBe(old.expiresAt.toISOString());

      expect(old.expiresAt.getTime()).toBeGreaterThanOrEqual(endFrom(before));
      expect(old.expiresAt.getTime()).toBeLessThanOrEqual(endFrom(Date.now()));
      expect((await userRoles(created.raw)).statusCode).toBe(
        keepOld === "none" ? 401 : 200,
      );
    },
  );

  it("audits both token ids, never a hash or hint", async () => {
    const created = await createClient();
    const next = newToken();

    const { body } = await rotate(created, next, "24h");
    const [audit] = await auditsOf(created.clientId, "ROTATE_API_TOKEN");

    expect(audit.event.audit.details.client).toMatchObject({
      tokenId: created.tokenId,
      rotation: { newTokenId: body.token.tokenId, keepOld: "24h" },
    });

    const recorded = JSON.stringify(audit);

    expect(recorded).not.toContain(next.hash);
    expect(recorded).not.toContain(created.hash);
    expect(recorded).not.toContain(`"${next.hint}"`);
  });

  it("refuses to rotate the request's own token with no overlap", async () => {
    const refused = await rotate(
      { clientId: CASE_READER_CLIENT, tokenId: await callerTokenId() },
      newToken(),
      "none",
    );

    expect(refused.statusCode).toBe(409);
    expect(refused.body.errorCode).toBe("API_TOKEN_IN_USE");
  });

  it("refuses a revoked token, inserting nothing", async () => {
    const created = await createClient();
    await revoke(created.clientId, created.tokenId);

    const refused = await rotate(created, newToken(), "24h");

    expect(refused.statusCode).toBe(409);
    expect(refused.body.errorCode).toBe("API_TOKEN_NOT_ACTIVE");
    expect(
      await accessTokens.countDocuments({ client: created.clientId }),
    ).toBe(1);
  });

  // A rotate that loses to a revoke matches nothing, and its insert aborts
  // with it: never a new token beside an old one it did not rotate.
  it("inserts nothing when the token is revoked under it", async () => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const created = await createClient();

      const [revoked, rotated] = await Promise.all([
        revoke(created.clientId, created.tokenId),
        rotate(created, newToken(), "7d"),
      ]);

      expect(revoked.statusCode).toBe(204);
      expect([201, 409]).toContain(rotated.statusCode);
      expect(
        await accessTokens.countDocuments({ client: created.clientId }),
      ).toBe(rotated.statusCode === 201 ? 2 : 1);
    }
  });
});

describe("DELETE /actuators/clients/{clientId}/tokens/{tokenId}", () => {
  it("refuses an active token, deleting nothing, audited as a failure", async () => {
    const created = await createClient();

    const refused = await removeToken(created);

    expect(refused.statusCode).toBe(409);
    expect(refused.body.errorCode).toBe("API_TOKEN_ACTIVE");
    expect(await stored(created.tokenId)).not.toBeNull();

    const [failure] = await auditsOf(created.clientId, "DELETE_API_TOKEN");

    expect(failure.event.audit.status).toBe("failure");
  });

  it.each([
    ["revoked", (created) => revoke(created.clientId, created.tokenId)],
    [
      "expired",
      (created) =>
        accessTokens.updateOne(
          { _id: new ObjectId(created.tokenId) },
          { $set: { expiresAt: new Date("2026-01-01T00:00:00.000Z") } },
        ),
    ],
  ])("deletes a %s token, audited by id alone", async (_, arrange) => {
    const created = await createClient();
    await issue(created.clientId, newToken());
    await arrange(created);

    const deleted = await removeToken(created);

    expect(deleted.statusCode).toBe(204);
    expect(await stored(created.tokenId)).toBeNull();

    const [audit] = await auditsOf(created.clientId, "DELETE_API_TOKEN");

    expect(audit.event.audit.details.client.tokenId).toBe(created.tokenId);
    expect(JSON.stringify(audit)).not.toContain(created.hash);
    expect(JSON.stringify(audit)).not.toContain(`"${created.hint}"`);
  });

  it("frees the client's name once its last token is deleted", async () => {
    const created = await createClient();
    await revoke(created.clientId, created.tokenId);

    await removeToken(created);

    expect(await rowsOf(created.clientId)).toEqual([]);
    expect((await issue(created.clientId, newToken(), true)).statusCode).toBe(
      201,
    );
  });

  it.each([
    [
      "an unknown token",
      (created) => ({ ...created, tokenId: new ObjectId().toHexString() }),
    ],
    ["another client's name", (created) => ({ ...created, clientId: aName() })],
    [
      "a name that fails the rule",
      (created) => ({ ...created, clientId: "Grants_UI" }),
    ],
  ])("answers 404 for %s", async (_, address) => {
    const created = await createClient();
    await revoke(created.clientId, created.tokenId);

    const missing = await removeToken(address(created));

    expect(missing.statusCode).toBe(404);
    expect(missing.body.errorCode).toBe("API_TOKEN_NOT_FOUND");
    expect(await stored(created.tokenId)).not.toBeNull();
  });

  // Whichever commits first, a revived token is never deleted.
  it("never deletes a token revived while it runs", async () => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const created = await createClient();
      await revoke(created.clientId, created.tokenId);

      const [deleted, revived] = await Promise.all([
        removeToken(created),
        changeExpiry(created, null),
      ]);

      expect([204, 409]).toContain(deleted.statusCode);
      expect([200, 404, 409]).toContain(revived.statusCode);
      expect(deleted.statusCode === 204 && revived.statusCode === 200).toBe(
        false,
      );
    }
  });
});

describe("issue, auth and revoke together", () => {
  it("creates a client whose token works at once and stops once revoked", async () => {
    const created = await createClient();

    expect((await userRoles(created.raw)).statusCode).toBe(200);

    const { statusCode } = await revoke(created.clientId, created.tokenId);

    expect(statusCode).toBe(204);
    expect((await userRoles(created.raw)).statusCode).toBe(401);
  });

  it("gives a new client's token the roles route and no actuator", async () => {
    const created = await createClient();
    const asNewClient = `Bearer ${created.raw}`;

    expect((await userRoles(created.raw)).statusCode).toBe(200);
    expect(
      (await call("get", "/actuators/clients", { token: asNewClient }))
        .statusCode,
    ).toBe(403);
    expect(
      (await revoke(created.clientId, created.tokenId, asNewClient)).statusCode,
    ).toBe(403);
  });

  it("keeps hashes out of every response and audit event", async () => {
    const created = await createClient();
    await issue(created.clientId, created);
    await revoke(created.clientId, created.tokenId);
    await revoke(CASE_READER_CLIENT, await callerTokenId());

    const listed = await list();
    const audits = await outbox
      .find({ "event.audit.entities.entity": "API_CLIENT" })
      .toArray();

    const recorded = JSON.stringify([listed, audits]);

    expect(audits.length).toBeGreaterThanOrEqual(5);
    expect(recorded).not.toContain(created.hash);
    expect(recorded).not.toContain(CALLER_HASH);
  });
});
