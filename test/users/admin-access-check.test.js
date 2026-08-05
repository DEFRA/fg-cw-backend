import { MongoClient } from "mongodb";
import { env } from "node:process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAdminUser, TestUser } from "../helpers/users.js";
import { wreck } from "../helpers/wreck.js";

let client;

describe("GET /admin/access-check", () => {
  beforeAll(async () => {
    client = new MongoClient(env.MONGO_URI);
    await client.connect();
  });

  afterAll(async () => {
    await client.close(true);
  });

  it("writes a VIEW_LANDING_PAGE audit event to the outbox", async () => {
    await createAdminUser();

    const response = await wreck.get("/admin/access-check");

    expect(response.res.statusCode).toEqual(200);

    const outboxEntry = await client
      .db()
      .collection("outbox")
      .findOne({ "event.audit.entities.action": "VIEW_LANDING_PAGE" });

    expect(outboxEntry).toMatchObject({
      event: {
        audit: {
          entities: [{ entity: "USER", action: "VIEW_LANDING_PAGE" }],
          status: "SUCCESS",
          details: {
            security: {
              actor: expect.objectContaining({
                idpId: TestUser.Admin.idpId,
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
