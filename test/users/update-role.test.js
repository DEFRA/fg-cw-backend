import { MongoClient } from "mongodb";
import { env } from "node:process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRole } from "../helpers/roles.js";
import {
  createAdminUser,
  createUser,
  getTokenFor,
  TestUser,
} from "../helpers/users.js";
import { wreck } from "../helpers/wreck.js";

let client;

describe("PUT /roles/{code}", () => {
  beforeAll(async () => {
    client = new MongoClient(env.MONGO_URI);
    await client.connect();
  });

  afterAll(async () => {
    await client.close(true);
  });

  it("updates a role", async () => {
    await createAdminUser();

    const createRoleResponse = await createRole({
      code: "ROLE_RPA_CASES_APPROVE",
      description: "Approve case applications",
      assignable: true,
    });

    expect(createRoleResponse.res.statusCode).toEqual(204);

    const updateRoleResponse = await wreck.put(
      "/roles/ROLE_RPA_CASES_APPROVE",
      {
        payload: {
          description: "Updated description",
          assignable: false,
        },
      },
    );

    expect(updateRoleResponse.res.statusCode).toEqual(204);

    const findRoleResponse = await wreck.get("/roles/ROLE_RPA_CASES_APPROVE");

    expect(findRoleResponse).toEqual({
      res: expect.objectContaining({
        statusCode: 200,
      }),
      payload: {
        id: expect.any(String),
        code: "ROLE_RPA_CASES_APPROVE",
        description: "Updated description",
        assignable: false,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      },
    });
  });

  it("returns 403 when user is not admin", async () => {
    await createUser(TestUser.ReadOnly);

    const token = await getTokenFor(TestUser.ReadOnly.email);

    await expect(
      wreck.put("/roles/ROLE_SHOULD_NOT_UPDATE", {
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          description: "Updated description",
          assignable: false,
        },
      }),
    ).rejects.toThrow("Response Error: 403 Forbidden");
  });

  it("returns 404 when role does not exist", async () => {
    await createAdminUser();

    await expect(
      wreck.put("/roles/ROLE_DOES_NOT_EXIST", {
        payload: {
          description: "Updated description",
          assignable: false,
        },
      }),
    ).rejects.toThrow("Response Error: 404 Not Found");
  });

  it("returns 400 when payload is incomplete", async () => {
    await createAdminUser();

    await expect(
      wreck.put("/roles/ROLE_RPA_CASES_APPROVE", {
        payload: {
          description: "Updated description",
        },
      }),
    ).rejects.toThrow("Response Error: 400 Bad Request");
  });
});
