import { MongoClient } from "mongodb";
import { env } from "node:process";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { wreck } from "../helpers/wreck.js";

let users;
let client;

beforeAll(async () => {
  client = new MongoClient(env.MONGO_URI);
  await client.connect();
  users = client.db().collection("users");
});

afterAll(async () => {
  await client.close(true);
});

describe("PATCH /users/{userId}", () => {
  beforeEach(async () => {
    await users.deleteMany({});
  });

  it("updates mutable properties", async () => {
    const createUserResponse = await wreck.post("/users", {
      payload: {
        idpId: "abcd1234-5678-90ab-cdef-1234567890ab",
        name: "Name",
        email: "name.surname@defra.gov.uk",
        idpRoles: ["defra-idp"],
        appRoles: ["ROLE_RPA_CASES_APPROVE"],
      },
    });

    const userId = createUserResponse.payload.id;

    const updateUserResponse = await wreck.patch(`/users/${userId}`, {
      payload: {
        name: "Updated Name",
        email: "NA",
        idpRoles: ["updated-idp", "replaces-all-roles"],
        appRoles: ["ROLE_RPA_1", "ROLE_RPA_2"],
      },
    });

    expect(updateUserResponse).toEqual({
      res: expect.objectContaining({
        statusCode: 200,
      }),
      payload: {
        id: userId,
        idpId: "abcd1234-5678-90ab-cdef-1234567890ab",
        name: "Updated Name",
        email: "name.surname@defra.gov.uk",
        idpRoles: ["updated-idp", "replaces-all-roles"],
        appRoles: ["ROLE_RPA_1", "ROLE_RPA_2"],
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      },
    });

    const findUserByIdResponse = await wreck.get(`/users/${userId}`);

    expect(findUserByIdResponse).toEqual({
      res: expect.objectContaining({
        statusCode: 200,
      }),
      payload: {
        id: userId,
        idpId: "abcd1234-5678-90ab-cdef-1234567890ab",
        name: "Updated Name",
        email: "name.surname@defra.gov.uk",
        idpRoles: ["updated-idp", "replaces-all-roles"],
        appRoles: ["ROLE_RPA_1", "ROLE_RPA_2"],
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      },
    });
  });

  it("does not update other propeties", async () => {
    const createUserResponse = await wreck.post("/users", {
      payload: {
        idpId: "abcd1234-5678-90ab-cdef-1234567890ab",
        name: "Name",
        email: "name.surname@defra.gov.uk",
        idpRoles: ["defra-idp"],
        appRoles: ["ROLE_RPA_CASES_APPROVE"],
      },
    });

    const userId = createUserResponse.payload.id;

    await wreck.patch(`/users/${userId}`, {
      payload: {
        idpId: "new-idp-id",
        email: "new.value@defra.gov.uk",
      },
    });

    const findUserByIdResponse = await wreck.get(`/users/${userId}`);

    expect(findUserByIdResponse).toEqual({
      res: expect.objectContaining({
        statusCode: 200,
      }),
      payload: {
        id: userId,
        idpId: "abcd1234-5678-90ab-cdef-1234567890ab", // not updated
        name: "Name",
        email: "name.surname@defra.gov.uk", // not updated
        idpRoles: ["defra-idp"],
        appRoles: ["ROLE_RPA_CASES_APPROVE"],
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      },
    });
  });
});
