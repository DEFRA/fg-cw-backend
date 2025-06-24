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
        firstName: "Name",
        lastName: "Surname",
        email: "name.surname@defra.gov.uk",
        idpRoles: ["defra-idp"],
        appRoles: ["cw-app"],
      },
    });

    const userId = createUserResponse.payload.id;

    const updateUserResponse = await wreck.patch(`/users/${userId}`, {
      payload: {
        firstName: "Updated Name",
        lastName: "Updated Surname",
        email: "NA",
        idpRoles: ["updated-idp", "replaces-all-roles"],
        appRoles: ["updated-app-role"],
      },
    });

    expect(updateUserResponse).toEqual({
      res: expect.objectContaining({
        statusCode: 204,
      }),
      payload: expect.any(Buffer),
    });

    const findUserByIdResponse = await wreck.get(`/users/${userId}`);

    expect(findUserByIdResponse).toEqual({
      res: expect.objectContaining({
        statusCode: 200,
      }),
      payload: {
        id: userId,
        idpId: "abcd1234-5678-90ab-cdef-1234567890ab",
        firstName: "Updated Name",
        lastName: "Updated Surname",
        email: "name.surname@defra.gov.uk",
        idpRoles: ["updated-idp", "replaces-all-roles"],
        appRoles: ["updated-app-role"],
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      },
    });
  });

  it("does not update other propeties", async () => {
    const createUserResponse = await wreck.post("/users", {
      payload: {
        idpId: "abcd1234-5678-90ab-cdef-1234567890ab",
        firstName: "Name",
        lastName: "Surname",
        email: "name.surname@defra.gov.uk",
        idpRoles: ["defra-idp"],
        appRoles: ["cw-app"],
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
        firstName: "Name",
        lastName: "Surname",
        email: "name.surname@defra.gov.uk", // not updated
        idpRoles: ["defra-idp"],
        appRoles: ["cw-app"],
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      },
    });
  });
});
