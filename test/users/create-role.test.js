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

describe("POST /roles", () => {
  beforeAll(async () => {
    client = new MongoClient(env.MONGO_URI);
    await client.connect();
  });

  afterAll(async () => {
    await client.close(true);
  });

  it("creates a role", async () => {
    await createAdminUser();

    const createRoleResponse = await createRole({
      code: "ROLE_RPA_CASES_APPROVE",
      description: "Approve case applications",
      assignable: true,
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
        data: {
          id: expect.any(String),
          code: "ROLE_RPA_CASES_APPROVE",
          description: "Approve case applications",
          assignable: true,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
        header: {
          navItems: [
            { title: "Admin", href: "/admin" },
            { title: "Casework", href: "/cases" },
          ],
        },
      },
    });
  });

  it("returns 403 when user is not admin", async () => {
    await createUser(TestUser.ReadOnly);

    const token = await getTokenFor(TestUser.ReadOnly.email);

    await expect(
      wreck.post("/roles", {
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          code: "ROLE_SHOULD_NOT_CREATE",
          description: "Should not be created",
          assignable: true,
        },
      }),
    ).rejects.toThrow("Response Error: 403 Forbidden");
  });

  it("does not create roles with the same code", async () => {
    await createAdminUser();

    const payload = {
      code: "ROLE_RPA_CASES_APPROVE",
      description: "Approve case applications",
      assignable: true,
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
