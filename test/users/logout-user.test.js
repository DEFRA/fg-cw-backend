import { MongoClient } from "mongodb";
import { randomUUID } from "node:crypto";
import { env } from "node:process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { wreck } from "../helpers/wreck.js";

let client;

beforeAll(async () => {
  client = new MongoClient(env.MONGO_URI);
  await client.connect();
});

afterAll(async () => {
  await client.close(true);
});

describe("POST /users/logout", () => {
  it("writes a LOGOUT audit event to the outbox for the user", async () => {
    const idpId = randomUUID();

    const { payload: user } = await wreck.post("/users/login", {
      payload: {
        idpId,
        name: "Logout Test User",
        email: "logout.test@defra.gov.uk",
        idpRoles: ["ReadWrite"],
      },
    });

    const response = await wreck.post("/users/logout", {
      payload: { userId: user.id },
    });

    expect(response.res.statusCode).toEqual(204);

    const outboxEntry = await client.db().collection("outbox").findOne({
      "event.audit.entities.action": "LOGOUT",
      "event.audit.entities.entityid": idpId,
    });

    expect(outboxEntry).toMatchObject({
      event: {
        audit: {
          entities: [{ entity: "USER", action: "LOGOUT", entityid: idpId }],
          status: "SUCCESS",
          details: {
            security: {
              actor: expect.objectContaining({
                id: user.id,
                idpId,
                name: "Logout Test User",
                email: "logout.test@defra.gov.uk",
                idpRoles: ["ReadWrite"],
              }),
            },
          },
        },
        security: { pmccode: "0703" },
      },
      target: expect.stringMatching(/^arn:aws:sns:eu-west-2:\d+:.*audit.*$/),
    });
  });

  it("returns 404 for an unknown user id", async () => {
    await expect(
      wreck.post("/users/logout", {
        payload: { userId: "507f1f77bcf86cd799439011" },
      }),
    ).rejects.toThrow("Response Error: 404 Not Found");
  });
});
