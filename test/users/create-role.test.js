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

describe("POST /roles", () => {
  beforeEach(async () => {
    await roles.deleteMany({});
  });

  it("creates a role", async () => {
    const createRoleResponse = await wreck.post("/roles", {
      payload: {
        code: "ROLE_RPA_CASES_APPROVE",
        description: "Approve case applications",
      },
    });

    expect(createRoleResponse).toEqual({
      res: expect.objectContaining({
        statusCode: 204,
      }),
      payload: expect.any(Object),
    });

    const findRoleByIdResponse = await wreck.get(
      "/roles/ROLE_RPA_CASES_APPROVE",
    );

    expect(findRoleByIdResponse).toEqual({
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

  it("does not create roles with the same code", async () => {
    const payload = {
      code: "ROLE_RPA_CASES_APPROVE",
      description: "Approve case applications",
    };

    await wreck.post("/roles", {
      payload,
    });

    await expect(
      wreck.post("/roles", {
        payload,
      }),
    ).rejects.toThrow("Response Error: 409 Conflict");
  });
});
