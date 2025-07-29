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

describe("GET /users/{userId}", () => {
  beforeEach(async () => {
    await users.deleteMany({});
  });

  it("finds a user by id", async () => {
    const createUserResponse = await wreck.post("/users", {
      payload: {
        idpId: "abcd1234-5678-90ab-cdef-1234567890ab",
        name: "Name",
        email: "name.surname@defra.gov.uk",
        idpRoles: ["defra-idp"],
        appRoles: [
          {
            name: "ROLE_RPA_CASES_APPROVE",
            startDate: "2025-07-28T15:28:35.313Z",
            endDate: "2025-07-28T15:28:35.313Z",
          },
        ],
      },
    });
    const userId = createUserResponse.payload.id;

    const findUserByIdResponse = await wreck.get(`/users/${userId}`);

    expect(findUserByIdResponse).toEqual({
      res: expect.objectContaining({
        statusCode: 200,
      }),
      payload: {
        id: userId,
        idpId: "abcd1234-5678-90ab-cdef-1234567890ab",
        name: "Name",
        email: "name.surname@defra.gov.uk",
        idpRoles: ["defra-idp"],
        appRoles: ["ROLE_RPA_CASES_APPROVE"],
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      },
    });
  });
});
