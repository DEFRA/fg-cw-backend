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

  // Scenarios 2 and 3 must be indistinguishable to the caller: nothing in the
  // response may reveal whether the account exists.
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

  it("returns roles for a user the admin list filter would exclude", async () => {
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

    expect(payload).toEqual({
      appRoles: [
        { roleName: "ROLE_WMP_CLAIMS", from: "2025-07-01", to: "2100-01-01" },
      ],
    });
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

  it("rejects an entraId that is not a uuid with 400", async () => {
    await expect(getRoles("not-a-uuid")).rejects.toThrow(
      "Response Error: 400 Bad Request",
    );
  });
});
