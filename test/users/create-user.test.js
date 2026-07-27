import { MongoClient } from "mongodb";
import { env } from "node:process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createAdminUser,
  createUser,
  getTokenFor,
  TestUser,
} from "../helpers/users.js";
import { wreck } from "../helpers/wreck.js";

let client;

describe("POST /admin/users (admin only)", () => {
  beforeAll(async () => {
    client = new MongoClient(env.MONGO_URI);
    await client.connect();
  });

  afterAll(async () => {
    await client.close(true);
  });

  it("writes a CREATE_USER audit event to the outbox with the created user as target", async () => {
    await createAdminUser();

    const createResponse = await wreck.post("/admin/users", {
      payload: {
        name: "Created By Admin",
        email: "created.by.admin@defra.gov.uk",
      },
    });

    expect(createResponse.res.statusCode).toEqual(200);

    const createdUserId = createResponse.payload.data.id;

    const outboxEntry = await client
      .db()
      .collection("outbox")
      .findOne({ "event.audit.entities.action": "CREATE_USER" });

    expect(outboxEntry).toMatchObject({
      event: {
        audit: {
          entities: [
            {
              entity: "USER",
              action: "CREATE_USER",
              entityid: createdUserId,
            },
          ],
          status: "SUCCESS",
          details: {
            security: {
              actor: expect.objectContaining({
                idpId: TestUser.Admin.idpId,
              }),
              targetUser: expect.objectContaining({
                id: createdUserId,
                email: "created.by.admin@defra.gov.uk",
              }),
            },
          },
        },
        security: { pmccode: "1204" },
      },
      target: expect.stringMatching(/^arn:aws:sns:eu-west-2:\d+:.*audit.*$/),
    });
  });

  it("returns 403 when user is not admin", async () => {
    await createUser(TestUser.ReadOnly);

    const token = await getTokenFor(TestUser.ReadOnly.email);

    await expect(
      wreck.post("/admin/users", {
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          name: "Should Not Create",
          email: "should.not.create@defra.gov.uk",
        },
      }),
    ).rejects.toThrow("Response Error: 403 Forbidden");
  });
});
