import { MongoClient } from "mongodb";
import { env } from "node:process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
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

describe("GET /roles/{code}", () => {
  it("returns a role by code", async () => {
    await createAdminUser();

    await createRole({
      code: "ROLE_RPA_CASES_APPROVE",
      description: "Approve case applications",
      assignable: true,
    });

    const findRoleResponse = await wreck.get("/roles/ROLE_RPA_CASES_APPROVE");

    expect(findRoleResponse).toEqual({
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

  it("returns 404 when role not found", async () => {
    const nonExistentCode = "ROLE_NON_EXISTENT";

    await expect(wreck.get(`/roles/${nonExistentCode}`)).rejects.toThrow(
      "Response Error: 404 Not Found",
    );
  });
});
