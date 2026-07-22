import { MongoClient } from "mongodb";
import { env } from "node:process";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createRole } from "../helpers/roles.js";
import { createAdminUser, TestUser } from "../helpers/users.js";
import { wreck } from "../helpers/wreck.js";

let client;
let outbox;

beforeAll(async () => {
  client = new MongoClient(env.MONGO_URI);
  await client.connect();
  outbox = client.db().collection("outbox");
});

afterAll(async () => {
  await client.close(true);
});

describe("GET /roles", () => {
  beforeEach(async () => {
    await createAdminUser();
  });

  it("returns all roles", async () => {
    await createRole({
      code: "TEST_ROLE_1",
      description: "Test role one",
      assignable: true,
    });

    await createRole({
      code: "TEST_ROLE_2",
      description: "Test role two",
      assignable: false,
    });

    const findRolesResponse = await wreck.get("/roles");

    expect(findRolesResponse).toEqual({
      res: expect.objectContaining({
        statusCode: 200,
      }),
      payload: {
        data: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            code: "TEST_ROLE_1",
            description: "Test role one",
            assignable: true,
            createdAt: expect.any(String),
            updatedAt: expect.any(String),
          }),
          expect.objectContaining({
            id: expect.any(String),
            code: "TEST_ROLE_2",
            description: "Test role two",
            assignable: false,
            createdAt: expect.any(String),
            updatedAt: expect.any(String),
          }),
        ]),
        header: {
          navItems: [
            { title: "Admin", href: "/admin" },
            { title: "Casework", href: "/cases" },
          ],
        },
      },
    });
  });

  it("returns empty array when no roles exist", async () => {
    const findRolesResponse = await wreck.get("/roles");

    expect(findRolesResponse).toEqual({
      res: expect.objectContaining({
        statusCode: 200,
      }),
      payload: {
        data: [],
        header: {
          navItems: [
            { title: "Admin", href: "/admin" },
            { title: "Casework", href: "/cases" },
          ],
        },
      },
    });
  });

  it("writes a VIEW_ROLE_LIST audit event to the outbox with the actor's security context", async () => {
    const response = await wreck.get("/roles");

    expect(response.res.statusCode).toBe(200);

    const outboxEntry = await outbox.findOne({
      "event.audit.entities.action": "VIEW_ROLE_LIST",
    });

    expect(outboxEntry).toMatchObject({
      event: {
        audit: {
          entities: [{ entity: "ROLE", action: "VIEW_ROLE_LIST" }],
          status: "SUCCESS",
          details: {
            security: {
              actor: {
                id: expect.any(String),
                idpId: TestUser.Admin.idpId,
                name: TestUser.Admin.name,
                email: TestUser.Admin.email,
                idpRoles: TestUser.Admin.idpRoles,
              },
            },
          },
        },
        security: { pmccode: "0706" },
      },
      target: expect.stringMatching(/^arn:aws:sns:eu-west-2:\d+:.*audit.*$/),
    });
  });
});
