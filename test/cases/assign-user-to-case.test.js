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

describe("PATCH /cases/{caseId}/assigned-user", () => {
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

    expect(findCaseByIdResponse.payload.assignedUser).toEqual({
      id: createUserResponse.payload.id,
      name: "Name",
    });
  });
});
