import { MongoClient } from "mongodb";
import { env } from "node:process";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { wreck } from "../helpers/wreck.js";

let roles;
let client;

beforeAll(async () => {
  client = new MongoClient(env.MONGO_URI);
  await client.connect();
  roles = client.db().collection("roles");
});

afterAll(async () => {
  await client.close(true);
});

describe("GET /roles/{code}", () => {
  beforeEach(async () => {
    await roles.deleteMany({});
  });

  it("returns a role by code", async () => {
    await wreck.post("/roles", {
      payload: {
        code: "ROLE_RPA_CASES_APPROVE",
        description: "Approve case applications",
      },
    });

    const findRoleResponse = await wreck.get("/roles/ROLE_RPA_CASES_APPROVE");

    expect(findRoleResponse).toEqual({
      res: expect.objectContaining({
        statusCode: 200,
      }),
      payload: {
        id: expect.any(String),
        code: "ROLE_RPA_CASES_APPROVE",
        description: "Approve case applications",
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      },
    });
  });

  it("returns 404 when role not found", async () => {
    const nonExistentCode = "ROLE_NON_EXISTENT";

    await expect(wreck.get(`/roles/${nonExistentCode}`)).rejects.toThrow(
      "Response Error: 404 Not Found",
    );
  });
});
