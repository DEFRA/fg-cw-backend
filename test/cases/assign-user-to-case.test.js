import { MongoClient } from "mongodb";
import { env } from "node:process";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  assignUserToCase,
  createCase,
  findCaseById,
} from "../helpers/cases.js";
import { createUser } from "../helpers/users.js";
import { createWorkflow } from "../helpers/workflows.js";

describe("PATCH /cases/{caseId}/assigned-user", () => {
  let cases;
  let workflows;
  let users;

  let client;

  beforeAll(async () => {
    client = new MongoClient(env.MONGO_URI);
    await client.connect();
    cases = client.db().collection("cases");
    workflows = client.db().collection("workflows");
    users = client.db().collection("users");
  });

  afterAll(async () => {
    await client.close(true);
  });

  beforeEach(async () => {
    await cases.deleteMany({});
    await workflows.deleteMany({});
    await users.deleteMany({});
    await createWorkflow();
  });

  afterEach(async () => {
    await cases.deleteMany({});
    await workflows.deleteMany({});
    await users.deleteMany({});
  });

  it("assigns a user to a case", async () => {
    const createUserResponse = await createUser();
    const kase = await createCase(cases);

    const assignUserToCaseResponse = await assignUserToCase(
      kase._id,
      createUserResponse.payload.id,
    );

    expect(assignUserToCaseResponse).toEqual({
      res: expect.objectContaining({
        statusCode: 204,
      }),
      payload: expect.any(Buffer),
    });

    const findCaseByIdResponse = await findCaseById(kase._id);

    expect(findCaseByIdResponse.assignedUser).toEqual({
      id: createUserResponse.payload.id,
    });
  });

  it("returns 404 not found when case does not exist", async () => {
    const createUserResponse = await createUser();
    const caseIdDoesNotExist = "507f1f77bcf86cd799439011";

    await expect(
      assignUserToCase(caseIdDoesNotExist, createUserResponse.payload.id),
    ).rejects.toThrow("Response Error: 404 Not Found");
  });

  it("returns 400 bad request for invalid case id", async () => {
    const createUserResponse = await createUser();
    const invalidCaseId = "invalid-case-id";

    await expect(
      assignUserToCase(invalidCaseId, createUserResponse.payload.id),
    ).rejects.toThrow("Bad Request");
  });

  it("returns 400 bad request for empty case id", async () => {
    const createUserResponse = await createUser();
    const emptyCaseId = "";

    await expect(
      assignUserToCase(emptyCaseId, createUserResponse.payload.id),
    ).rejects.toThrow("Not Found");
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

  it("returns 401 unauthorized for user missing required allOf roles", async () => {
    const kase = await createCase(cases);
    const createUserResponse = await createUser({
      appRoles: {
        ROLE_1: {
          startDate: "01/01/2025",
          endDate: "02/08/2025",
        },
      }, // Missing ROLE_1 and ROLE_2 from allOf
    });

    await expect(
      assignUserToCase(kase._id, createUserResponse.payload.id),
    ).rejects.toThrow("Unauthorized");
  });

  it("returns 401 unauthorized for user missing required anyOf roles", async () => {
    const kase = await createCase(cases);
    const createUserResponse = await createUser({
      appRoles: {
        ROLE_1: {
          startDate: "01/01/2025",
          endDate: "02/08/2025",
        },
        ROLE_2: {
          startDate: "01/01/2025",
          endDate: "02/08/2025",
        },
      }, // Missing ROLE_3 from anyOf
    });

    await expect(
      assignUserToCase(kase._id, createUserResponse.payload.id),
    ).rejects.toThrow("Unauthorized");
  });

  it("unassigns a user when assignedUserId is set to null", async () => {
    const createUserResponse = await createUser();
    const kase = await createCase(cases);

    // First assign a user to the case
    await assignUserToCase(kase._id, createUserResponse.payload.id);

    // Verify user is assigned
    const findCaseAfterAssignResponse = await findCaseById(kase._id);
    expect(findCaseAfterAssignResponse.assignedUser.id).toEqual(
      createUserResponse.payload.id,
    );

    // Now unassign the user by setting assignedUserId to null
    const { res } = await assignUserToCase(kase._id, null);

    expect(res.statusCode).toBe(204);

    // Verify user is unassigned
    const findCaseAfterUnassignResponse = await findCaseById(kase._id);

    expect(findCaseAfterUnassignResponse.assignedUser).toBeNull();
  });
});
