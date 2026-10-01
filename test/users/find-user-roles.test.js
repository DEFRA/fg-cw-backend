import { MongoClient } from "mongodb";
import { env } from "node:process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SERVICE_TOKEN } from "../helpers/service-token.js";
import {
  changeUserAppRoles,
  createUser,
  getTokenFor,
  TestUser,
} from "../helpers/users.js";
import { wreck } from "../helpers/wreck.js";

const UNKNOWN_ENTRA_ID = "11111111-2222-3333-4444-555555555555";

let client;
let users;

const getRoles = (entraId, token = `Bearer ${SERVICE_TOKEN}`) =>
  wreck.get(`/api/users/${entraId}/roles`, {
    headers: { authorization: token },
  });

const getRolesError = async (entraId, token) => {
  try {
    await getRoles(entraId, token);
  } catch (err) {
    return {
      statusCode: err.data.res.statusCode,
      payload: String(err.data.payload ?? ""),
    };
  }

  throw new Error("Expected the request to be rejected");
};

beforeAll(async () => {
  client = await MongoClient.connect(env.MONGO_URI);
  users = client.db().collection("users");
});

afterAll(async () => {
  await client?.close(true);
});

describe("GET /api/users/{entraId}/roles", () => {
  it("returns an active role with its date range", async () => {
    const user = await createUser({
      idpId: "a1b2c3d4-0001-0000-0000-000000000001",
      email: "roles.active@t.gov.uk",
    });
    await changeUserAppRoles(user, {
      ROLE_WMP_CLAIMS: { startDate: "2025-07-01", endDate: "2100-01-01" },
    });

    const { payload } = await getRoles(user.idpId);

    expect(payload).toEqual({
      appRoles: [
        { roleName: "ROLE_WMP_CLAIMS", from: "2025-07-01", to: "2100-01-01" },
      ],
    });
  });

  it("returns null dates for an open-ended role", async () => {
    const user = await createUser({
      idpId: "a1b2c3d4-0001-0000-0000-000000000002",
      email: "roles.openended@t.gov.uk",
    });
    await changeUserAppRoles(user, { ROLE_WMP_CLAIMS: {} });

    const { payload } = await getRoles(user.idpId);

    expect(payload).toEqual({
      appRoles: [{ roleName: "ROLE_WMP_CLAIMS", from: null, to: null }],
    });
  });

  it("excludes a role that is out of its date range", async () => {
    const user = await createUser({
      idpId: "a1b2c3d4-0001-0000-0000-000000000003",
      email: "roles.expired@t.gov.uk",
    });
    await changeUserAppRoles(user, {
      ROLE_WMP_CLAIMS: { startDate: "2020-01-01", endDate: "2020-12-31" },
    });

    const { payload } = await getRoles(user.idpId);

    expect(payload).toEqual({ appRoles: [] });
  });

  it("returns an empty list for a user with no roles", async () => {
    const user = await createUser({
      idpId: "a1b2c3d4-0001-0000-0000-000000000004",
      email: "roles.none@t.gov.uk",
    });
    await changeUserAppRoles(user, {});

    const { payload } = await getRoles(user.idpId);

    expect(payload).toEqual({ appRoles: [] });
  });

  it("answers an unknown user exactly as it answers one with no roles", async () => {
    const user = await createUser({
      idpId: "a1b2c3d4-0001-0000-0000-000000000005",
      email: "roles.compare@t.gov.uk",
    });
    await changeUserAppRoles(user, {});

    const known = await getRoles(user.idpId);
    const unknown = await getRoles(UNKNOWN_ENTRA_ID);

    expect(await users.findOne({ idpId: UNKNOWN_ENTRA_ID })).toEqual(null);
    expect(unknown.payload).toEqual({ appRoles: [] });
    expect(unknown.payload).toEqual(known.payload);
    expect(unknown.res.statusCode).toEqual(known.res.statusCode);
  });

  // Caseworking's own login lookup excludes these users, so exposing their
  // roles externally would grant access CW itself would refuse.
  it("returns no roles for a user caseworking treats as unknown", async () => {
    const user = await createUser({
      idpId: "a1b2c3d4-0001-0000-0000-000000000006",
      email: "roles.placeholder@t.gov.uk",
    });
    await changeUserAppRoles(user, {
      ROLE_WMP_CLAIMS: { startDate: "2025-07-01", endDate: "2100-01-01" },
    });
    await users.updateOne(
      { idpId: user.idpId },
      { $set: { name: "placeholder" } },
    );

    const { payload } = await getRoles(user.idpId);

    expect(payload).toEqual({ appRoles: [] });
  });

  // The FGP-726 migration wrote these rows with ISO string dates and they are
  // still live in prod, where the cleanup migration does not run.
  it("does not error on a legacy user whose dates are ISO strings", async () => {
    const idpId = "a1b2c3d4-0001-0000-0000-000000000007";

    await users.insertOne({
      idpId,
      name: "placeholder",
      email: "roles.legacy@rpa.gov.uk",
      idpRoles: [],
      appRoles: {
        ROLE_WMP_CLAIMS: { startDate: "2000-01-01", endDate: "2100-01-01" },
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const { res, payload } = await getRoles(idpId);

    expect(res.statusCode).toEqual(200);
    expect(payload).toEqual({ appRoles: [] });
  });

  it("rejects a request with no token", async () => {
    await expect(getRoles(UNKNOWN_ENTRA_ID, null)).rejects.toThrow(
      "Response Error: 401 Unauthorized",
    );
  });

  it("rejects a token with no Bearer prefix", async () => {
    await expect(getRoles(UNKNOWN_ENTRA_ID, SERVICE_TOKEN)).rejects.toThrow(
      "Response Error: 401 Unauthorized",
    );
  });

  it("rejects an unknown token", async () => {
    await expect(
      getRoles(UNKNOWN_ENTRA_ID, "Bearer 00000000-0000-0000-0000-000000000000"),
    ).rejects.toThrow("Response Error: 401 Unauthorized");
  });

  it("rejects a valid Entra user token", async () => {
    const token = await getTokenFor(TestUser.Admin.email);

    await expect(getRoles(UNKNOWN_ENTRA_ID, `Bearer ${token}`)).rejects.toThrow(
      "Response Error: 401 Unauthorized",
    );
  });

  it("returns no response body on a 401", async () => {
    const { statusCode, payload } = await getRolesError(UNKNOWN_ENTRA_ID, null);

    expect(statusCode).toEqual(401);
    expect(payload).toEqual("");
  });

  it("returns no response body on a 401 for a bad bearer token", async () => {
    const { statusCode, payload } = await getRolesError(
      UNKNOWN_ENTRA_ID,
      "Bearer 00000000-0000-4000-8000-000000000000",
    );

    expect(statusCode).toEqual(401);
    expect(payload).toEqual("");
  });

  it("rejects an entraId that is not a uuid with 400", async () => {
    await expect(getRoles("not-a-uuid")).rejects.toThrow(
      "Response Error: 400 Bad Request",
    );
  });
});
