import { MongoClient } from "mongodb";
import { env } from "node:process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAdminUser, createUser } from "../helpers/users.js";
import { wreck } from "../helpers/wreck.js";

let client;

describe("GET /admin/users/{userId} (admin only)", () => {
  beforeAll(async () => {
    client = new MongoClient(env.MONGO_URI);
    await client.connect();
  });

  afterAll(async () => {
    await client.close(true);
  });

  it("writes a VIEW_USER_DETAILS audit event to the outbox with the target id", async () => {
    await createAdminUser();

    const testUser = await createUser({
      idpId: "00000000-0000-0000-0000-000000000077",
      name: "View Target",
      email: "view.target@defra.gov.uk",
      idpRoles: ["FCP.Casework.Read"],
    });

    const response = await wreck.get(`/admin/users/${testUser.id}`);

    expect(response.res.statusCode).toEqual(200);

    const outboxEntry = await client
      .db()
      .collection("outbox")
      .findOne({ "event.audit.entities.action": "VIEW_USER_DETAILS" });

    expect(outboxEntry).toMatchObject({
      event: {
        audit: {
          entities: [
            {
              entity: "USER",
              action: "VIEW_USER_DETAILS",
              entityid: testUser.id,
            },
          ],
          status: "SUCCESS",
          details: {
            security: {
              targetUser: expect.objectContaining({
                id: testUser.id,
                idpId: "00000000-0000-0000-0000-000000000077",
                name: "View Target",
                email: "view.target@defra.gov.uk",
                idpRoles: ["FCP.Casework.Read"],
              }),
            },
          },
        },
        security: { pmccode: "0706" },
      },
      target: expect.stringMatching(/^arn:aws:sns:eu-west-2:\d+:.*audit.*$/),
    });
  });
});
