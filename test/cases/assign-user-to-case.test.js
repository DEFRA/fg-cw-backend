import { MongoClient } from "mongodb";
import { env } from "node:process";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { IdpRoles } from "../../src/users/models/idp-roles.js";
import {
  assignUserToCase,
  createCase,
  findCaseById,
} from "../helpers/cases.js";
import {
  changeUserIdpRoles,
  createAdminUser,
  createUser,
  removeUserAppRoles,
} from "../helpers/users.js";
import { createWorkflow } from "../helpers/workflows.js";

describe("PATCH /cases/{caseId}/assigned-user", () => {
  let cases;

  let client;
  let user;

  beforeAll(async () => {
    client = new MongoClient(env.MONGO_URI);
    await client.connect();
    cases = client.db().collection("cases");
  });

  afterAll(async () => {
    await client.close(true);
  });

  beforeEach(async () => {
    user = await createAdminUser();
    await createWorkflow();

    await changeUserIdpRoles(user, [IdpRoles.ReadWrite]);
  });

  it("assigns a user to a case", async () => {
    const createdUser = await createAdminUser();
    await changeUserIdpRoles(createdUser, [IdpRoles.ReadWrite]);

    const kase = await createCase(cases);

    const assignUserToCaseResponse = await assignUserToCase(
      kase._id,
      createdUser.id,
    );

    expect(assignUserToCaseResponse).toEqual({
      res: expect.objectContaining({
        statusCode: 204,
      }),
      payload: expect.any(Buffer),
    });

    const findCaseByIdResponse = await findCaseById(kase._id);

    expect(findCaseByIdResponse.assignedUser).toEqual({
      id: createdUser.id,
    });
  });

  it("returns 403 when actor does not have ReadWrite role", async () => {
    await changeUserIdpRoles(user, [IdpRoles.Read]);

    const createdUser = await createUser();
    const kase = await createCase(cases);

    await expect(assignUserToCase(kase._id, createdUser.id)).rejects.toThrow(
      "Response Error: 403 Forbidden",
    );
  });

  it("returns 403 when user does not have required workflow roles", async () => {
    await removeUserAppRoles(user);

    const createdUser = await createUser();
    const kase = await createCase(cases);

    await expect(assignUserToCase(kase._id, createdUser.id)).rejects.toThrow(
      "Response Error: 403 Forbidden",
    );
  });

  it("returns 404 not found when case does not exist", async () => {
    const createdUser = await createUser();
    const caseIdDoesNotExist = "507f1f77bcf86cd799439011";

    await expect(
      assignUserToCase(caseIdDoesNotExist, createdUser.id),
    ).rejects.toThrow("Response Error: 404 Not Found");
  });

  it("returns 400 bad request for invalid case id", async () => {
    const createdUser = await createUser();
    const invalidCaseId = "invalid-case-id";

    await expect(
      assignUserToCase(invalidCaseId, createdUser.id),
    ).rejects.toThrow("Bad Request");
  });

  it("returns 400 bad request for empty case id", async () => {
    const createdUser = await createUser();
    const emptyCaseId = "";

    await expect(assignUserToCase(emptyCaseId, createdUser.id)).rejects.toThrow(
      "Not Found",
    );
  });

  it("returns 404 not found when user does not exist", async () => {
    const kase = await createCase(cases);
    const nonExistentUserId = "507f1f77bcf86cd799439011";

    await expect(assignUserToCase(kase._id, nonExistentUserId)).rejects.toThrow(
      "Response Error: 404 Not Found",
    );
  });

  it("returns 400 bad request for invalid user id", async () => {
    const kase = await createCase(cases);
    const invalidUserId = "invalid-user-id";

    await expect(assignUserToCase(kase._id, invalidUserId)).rejects.toThrow(
      "Bad Request",
    );
  });

  it("returns 401 unauthorised for user missing required allOf roles", async () => {
    const kase = await createCase(cases);
    const createdUser = await createUser({
      appRoles: {
        ROLE_1: {
          startDate: "2025-07-01",
          endDate: "2025-08-02",
        },
      },
    });

    await expect(assignUserToCase(kase._id, createdUser.id)).rejects.toThrow(
      "Response Error: 401 Unauthorized",
    );
  });

  it("returns 401 unauthorised for user missing required anyOf roles", async () => {
    const kase = await createCase(cases);
    const createdUser = await createUser({
      appRoles: {
        ROLE_1: {
          startDate: "2025-07-01",
          endDate: "2025-08-02",
        },
        ROLE_2: {
          startDate: "2025-07-01",
          endDate: "2025-08-02",
        },
      }, // Missing ROLE_3 from anyOf
    });

    await expect(assignUserToCase(kase._id, createdUser.id)).rejects.toThrow(
      "Response Error: 401 Unauthorized",
    );
  });

  it("unassigns a user when assignedUserId is set to null", async () => {
    const createdUser = await createAdminUser();
    await changeUserIdpRoles(createdUser, [IdpRoles.ReadWrite]);

    const kase = await createCase(cases);

    // First assign a user to the case
    await assignUserToCase(kase._id, createdUser.id);

    // Verify user is assigned
    const findCaseAfterAssignResponse = await findCaseById(kase._id);

    expect(findCaseAfterAssignResponse.assignedUser.id).toEqual(createdUser.id);

    // Now unassign the user by setting assignedUserId to null
    const { res } = await assignUserToCase(kase._id, null);

    expect(res.statusCode).toBe(204);

    // Verify user is unassigned
    const findCaseAfterUnassignResponse = await findCaseById(kase._id);

    expect(findCaseAfterUnassignResponse.assignedUser).toBeNull();
  });
});
