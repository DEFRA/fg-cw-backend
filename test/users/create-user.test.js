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

describe("POST /users", () => {
  beforeEach(async () => {
    await users.deleteMany({});
  });

  it("adds a user", async () => {
    const createUserResponse = await wreck.post("/users", {
      payload: {
        idpId: "abcd1234-5678-90ab-cdef-1234567890ab",
        name: "Name",
        email: "name.surname@defra.gov.uk",
        idpRoles: ["defra-idp"],
        appRoles: ["cw-app"],
      },
    });

    expect(createUserResponse).toEqual({
      res: expect.objectContaining({
        statusCode: 201,
      }),
      payload: {
        id: expect.any(String),
      },
    });

    const findUserResponse = await wreck.get(
      `/users/${createUserResponse.payload.id}`,
    );

    expect(findUserResponse).toEqual({
      res: expect.objectContaining({
        statusCode: 200,
      }),
      payload: {
        id: expect.any(String),
        idpId: "abcd1234-5678-90ab-cdef-1234567890ab",
        name: "Name",
        email: "name.surname@defra.gov.uk",
        idpRoles: ["defra-idp"],
        appRoles: ["cw-app"],
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      },
    });
  });

  it("does not add users with the same email addresses", async () => {
    const payload = {
      idpId: "abcd1234-5678-90ab-cdef-1234567890ab",
      name: "Name",
      email: "name.surname@defra.gov.uk",
      idpRoles: ["defra-idp"],
      appRoles: ["cw-app"],
    };

    await wreck.post("/users", {
      payload,
    });

    await expect(
      wreck.post("/users", {
        payload,
      }),
    ).rejects.toThrow("Response Error: 409 Conflict");
  });
});
