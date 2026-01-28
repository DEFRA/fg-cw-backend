import { MongoClient } from "mongodb";
import { env } from "node:process";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createRole } from "../helpers/roles.js";
import { createAdminUser } from "../helpers/users.js";
import { wreck } from "../helpers/wreck.js";

let client;

beforeAll(async () => {
  client = new MongoClient(env.MONGO_URI);
  await client.connect();
});

afterAll(async () => {
  await client.close(true);
});

describe("GET /roles", () => {
  beforeEach(async () => {
    await createAdminUser();
  });

  it("returns all roles", async () => {
    await createRole({
      code: "TEST_ROLE_1",
      description: "Test role one",
      assignable: true,
    });

    await createRole({
      code: "TEST_ROLE_2",
      description: "Test role two",
      assignable: false,
    });

    const findRolesResponse = await wreck.get("/roles");

    expect(findRolesResponse).toEqual({
      res: expect.objectContaining({
        statusCode: 200,
      }),
      payload: expect.arrayContaining([
        expect.objectContaining({
          id: expect.any(String),
          code: "TEST_ROLE_1",
          description: "Test role one",
          assignable: true,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        }),
        expect.objectContaining({
          id: expect.any(String),
          code: "TEST_ROLE_2",
          description: "Test role two",
          assignable: false,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        }),
      ]),
    });
  });

  it("returns empty array when no roles exist", async () => {
    const findRolesResponse = await wreck.get("/roles");

    expect(findRolesResponse).toEqual({
      res: expect.objectContaining({
        statusCode: 200,
      }),
      payload: [],
    });
  });
});
