import { MongoClient } from "mongodb";
import { env } from "node:process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAdminUser, createUser } from "../helpers/users.js";
import { wreck } from "../helpers/wreck.js";

let client;

beforeAll(async () => {
  client = new MongoClient(env.MONGO_URI);
  await client.connect();
});

afterAll(async () => {
  await client.close(true);
});

describe("PATCH /users/{userId} (admin only)", () => {
  it("allows admin to update another user's properties", async () => {
    // Create an admin user to run the test
    await createAdminUser();

    // Create a separate user to be updated by the admin.
    const testUser = await createUser({
      idpId: "00000000-0000-0000-0000-000000000001",
      name: "Name",
      email: "name.surname@defra.gov.uk",
      idpRoles: ["FCP.Casework.Read"],
    });

    const userId = testUser.id;

    const updateUserResponse = await wreck.patch(`/users/${userId}`, {
      payload: {
        name: "Updated Name",
        email: "new.email@example.com",
        idpRoles: ["FCP.Casework.Admin"],
        appRoles: {
          ROLE_RPA_1: {
            startDate: "2025-07-01",
            endDate: "2025-08-02",
          },
          ROLE_RPA_2: {
            startDate: "2025-07-01",
            endDate: "2025-08-02",
          },
        },
      },
    });

    expect(updateUserResponse).toEqual({
      res: expect.objectContaining({
        statusCode: 200,
      }),
      payload: {
        id: userId,
        idpId: "00000000-0000-0000-0000-000000000001",
        name: "Updated Name",
        email: "new.email@example.com",
        idpRoles: ["FCP.Casework.Admin"],
        appRoles: {
          ROLE_RPA_1: {
            startDate: "2025-07-01",
            endDate: "2025-08-02",
          },
          ROLE_RPA_2: {
            startDate: "2025-07-01",
            endDate: "2025-08-02",
          },
        },
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        lastLoginAt: expect.any(String),
      },
    });

    const findUserByIdResponse = await wreck.get(`/admin/users/${userId}`);

    expect(findUserByIdResponse).toEqual({
      res: expect.objectContaining({
        statusCode: 200,
      }),
      payload: {
        id: userId,
        idpId: "00000000-0000-0000-0000-000000000001",
        name: "Updated Name",
        email: "new.email@example.com",
        idpRoles: ["FCP.Casework.Admin"],
        appRoles: {
          ROLE_RPA_1: {
            startDate: "2025-07-01",
            endDate: "2025-08-02",
          },
          ROLE_RPA_2: {
            startDate: "2025-07-01",
            endDate: "2025-08-02",
          },
        },
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        lastLoginAt: expect.any(String),
      },
    });
  });

  it("admin cannot update their own appRoles", async () => {
    // Create an admin user to run the test

    const adminUser = await createAdminUser({
      name: "Admin User",
      email: "admin@t.gov.uk",
      appRoles: {
        ROLE_RPA_CASES_APPROVE: {
          startDate: "2025-07-01",
          endDate: "2025-08-02",
        },
      },
    });

    await expect(
      wreck.patch(`/users/${adminUser.id}`, {
        payload: {
          appRoles: {
            ROLE_MONEY_TRANSFER_APPROVE: {
              startDate: "2025-07-01",
              endDate: "2025-08-02",
            },
          },
        },
      }),
    ).rejects.toThrow("Response Error: 403 Forbidden");
  });
});
