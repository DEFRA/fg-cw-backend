import { MongoClient } from "mongodb";
import { env } from "node:process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRole } from "../helpers/roles.js";
import { createAdminUser, TestUser } from "../helpers/users.js";
import { wreck } from "../helpers/wreck.js";

let client;
let outbox;

describe("GET /roles/{code}", () => {
  beforeAll(async () => {
    client = new MongoClient(env.MONGO_URI);
    await client.connect();
    outbox = client.db().collection("outbox");
  });

  afterAll(async () => {
    await client.close(true);
  });

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
    await createAdminUser();

    const nonExistentCode = "ROLE_NON_EXISTENT";

    await expect(wreck.get(`/roles/${nonExistentCode}`)).rejects.toThrow(
      "Response Error: 404 Not Found",
    );
  });

  it("writes a VIEW_ROLE audit event to the outbox with the role code and actor's security context", async () => {
    await createAdminUser();

    await createRole({
      code: "ROLE_RPA_CASES_VIEW",
      description: "View case applications",
      assignable: true,
    });

    const response = await wreck.get("/roles/ROLE_RPA_CASES_VIEW");

    expect(response.res.statusCode).toBe(200);

    const outboxEntry = await outbox.findOne({
      "event.audit.entities.action": "VIEW_ROLE",
      "event.audit.entities.entityid": "ROLE_RPA_CASES_VIEW",
    });

    expect(outboxEntry).toMatchObject({
      event: {
        audit: {
          entities: [
            {
              entity: "ROLE",
              action: "VIEW_ROLE",
              entityid: "ROLE_RPA_CASES_VIEW",
            },
          ],
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
