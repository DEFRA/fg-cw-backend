import { MongoClient } from "mongodb";
import { createServer } from "node:http";
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

import { IdpRoles } from "../../src/users/models/idp-roles.js";
import { createCase, findCaseById } from "../helpers/cases.js";
import {
  changeUserIdpRoles,
  createAdminUser,
  removeUserAppRoles,
} from "../helpers/users.js";
import { createWorkflow } from "../helpers/workflows.js";
import { wreck } from "../helpers/wreck.js";

describe("POST /cases/{caseId}/page-action", () => {
  let cases;
  let outbox;
  let users;
  let client;
  let externalAction;
  let user;

  beforeAll(async () => {
    client = new MongoClient(env.MONGO_URI);
    await client.connect();
    cases = client.db().collection("cases");
    outbox = client.db().collection("outbox");
    users = client.db().collection("users");
  });

  afterAll(async () => {
    await client.close(true);
  });

  beforeEach(async () => {
    externalAction = createServer((req, res) => {
      let body = "";

      req.on("data", (chunk) => (body += chunk));

      req.on("end", () => {
        res.writeHead(200, { "Content-Type": "application/json" });

        res.end(
          JSON.stringify({
            method: req.method,
            url: req.url,
            headers: {
              authorization: req.headers.authorization,
              "content-type": req.headers["content-type"],
              "x-api-key": req.headers["x-api-key"],
              "defra-email": req.headers["defra-email"],
            },
            body: JSON.parse(body),
          }),
        );
      });
    });

    await new Promise((resolve) =>
      externalAction.listen(5666, "0.0.0.0", resolve),
    );

    user = await createAdminUser();

    await createWorkflow({
      externalActions: [
        {
          code: "TEST_ACTION",
          name: "Perform action",
          description: "Do some work",
          endpoint: {
            code: "TEST_ENDPOINT",
            endpointParams: {
              BODY: {
                scheme: "$.payload.answers.scheme",
                requesterUsername: "CASEWORKING_SYSTEM",
              },
            },
          },
          display: true,
          target: {
            position: null,
            targetNode: "output",
            dataType: "ARRAY",
            place: "append",
          },
        },
        {
          code: "TEST_ACTION_AS_CASEWORKER",
          name: "Perform action as caseworker",
          description: "Do some work for the caseworker",
          endpoint: {
            code: "TEST_ENDPOINT_AS_CASEWORKER",
            endpointParams: {
              HEADERS: {
                "Defra-Email": "$.user.email",
              },
              BODY: {
                scheme: "$.payload.answers.scheme",
              },
            },
          },
          display: false,
          target: {
            position: null,
            targetNode: "output",
            dataType: "ARRAY",
            place: "append",
          },
        },
      ],
      endpoints: [
        {
          code: "TEST_ENDPOINT",
          service: "TEST_EXTERNAL_SERVICE",
          path: "/do-some-work",
          method: "POST",
        },
        {
          code: "TEST_ENDPOINT_AS_CASEWORKER",
          service: "TEST_EXTERNAL_SERVICE",
          path: "/do-some-work-as-caseworker",
          method: "POST",
        },
      ],
    });

    await changeUserIdpRoles(user, [IdpRoles.ReadWrite]);
  });

  afterEach(async () => {
    await new Promise((resolve) => externalAction.close(resolve));
  });

  it("executes external action and stores response in supplementaryData", async () => {
    const kase = await createCase(cases);

    const response = await wreck.post(`/cases/${kase._id}/page-action`, {
      payload: {
        actionCode: "TEST_ACTION",
      },
    });

    expect(response.res.statusCode).toBe(204);

    const updatedCase = await findCaseById(kase._id);
    const output = updatedCase.supplementaryData.getNode("output");

    expect(output).toEqual([
      {
        method: "POST",
        url: "/do-some-work",
        headers: {
          authorization: "Bearer replace-with-auth-token",
          "content-type": "application/json",
          "x-api-key": "replace-with-your-developer-api-key",
        },
        body: {
          scheme: "SFI",
          requesterUsername: "CASEWORKING_SYSTEM",
        },
      },
    ]);

    expect(output[0].headers).not.toHaveProperty("defra-email");

    // Verify timeline event was created for the external action with display: true
    const timelineEvent = updatedCase.timeline.find(
      (event) => event.eventType === "EXTERNAL_ACTION_TRIGGERED",
    );
    expect(timelineEvent).toBeDefined();
    expect(timelineEvent.data.actionName).toBe("Perform action");
    expect(timelineEvent.description).toBe("Action - Perform action");
  });

  it("sends the caseworker's email as Defra-Email when the action's HEADERS ask for it", async () => {
    const kase = await createCase(cases);

    const response = await wreck.post(`/cases/${kase._id}/page-action`, {
      payload: {
        actionCode: "TEST_ACTION_AS_CASEWORKER",
      },
    });

    expect(response.res.statusCode).toBe(204);

    const updatedCase = await findCaseById(kase._id);

    expect(updatedCase.supplementaryData.getNode("output")).toEqual([
      expect.objectContaining({
        url: "/do-some-work-as-caseworker",
        headers: expect.objectContaining({
          "defra-email": user.email,
        }),
      }),
    ]);
  });

  it("returns 400 without calling the endpoint when the caseworker has no email", async () => {
    await users.updateOne({ idpId: user.idpId }, { $unset: { email: "" } });

    const kase = await createCase(cases);

    await expect(
      wreck.post(`/cases/${kase._id}/page-action`, {
        payload: {
          actionCode: "TEST_ACTION_AS_CASEWORKER",
        },
      }),
    ).rejects.toThrow("Response Error: 400 Bad Request");

    const unchangedCase = await findCaseById(kase._id);

    expect(unchangedCase.supplementaryData.getNode("output")).toBeUndefined();
  });

  it("returns 403 when user does not have ReadWrite role", async () => {
    await changeUserIdpRoles(user, [IdpRoles.Read]);

    const kase = await createCase(cases);

    await expect(
      wreck.post(`/cases/${kase._id}/page-action`, {
        payload: {
          actionCode: "TEST_ACTION",
        },
      }),
    ).rejects.toThrow("Response Error: 403 Forbidden");
  });

  it("returns 403 when user does not have required workflow roles", async () => {
    await removeUserAppRoles(user);

    const kase = await createCase(cases);

    await expect(
      wreck.post(`/cases/${kase._id}/page-action`, {
        payload: {
          actionCode: "TEST_ACTION",
        },
      }),
    ).rejects.toThrow("Response Error: 403 Forbidden");
  });

  it("returns 404 when case does not exist", async () => {
    const nonExistentCaseId = "507f1f77bcf86cd799439011";

    await expect(
      wreck.post(`/cases/${nonExistentCaseId}/page-action`, {
        payload: {
          actionCode: "SOME_ACTION",
        },
      }),
    ).rejects.toThrow("Response Error: 404 Not Found");
  });

  it("returns 400 for invalid case id format", async () => {
    const invalidCaseId = "invalid-case-id";

    await expect(
      wreck.post(`/cases/${invalidCaseId}/page-action`, {
        payload: {
          actionCode: "SOME_ACTION",
        },
      }),
    ).rejects.toThrow("Bad Request");
  });

  it("returns 404 when action code does not exist in workflow", async () => {
    const kase = await createCase(cases);

    await expect(
      wreck.post(`/cases/${kase._id}/page-action`, {
        payload: {
          actionCode: "NON_EXISTENT_ACTION",
        },
      }),
    ).rejects.toThrow("Response Error: 404 Not Found");
  });

  it("returns 400 when action code is missing", async () => {
    const kase = await createCase(cases);

    await expect(
      wreck.post(`/cases/${kase._id}/page-action`, {
        payload: {},
      }),
    ).rejects.toThrow("Bad Request");
  });

  it("returns 400 when action code is empty", async () => {
    const kase = await createCase(cases);

    await expect(
      wreck.post(`/cases/${kase._id}/page-action`, {
        payload: {
          actionCode: "",
        },
      }),
    ).rejects.toThrow("Bad Request");
  });

  it("writes a PERFORM_PAGE_ACTION audit event to the outbox with the actor's security context", async () => {
    const kase = await createCase(cases);

    const response = await wreck.post(`/cases/${kase._id}/page-action`, {
      payload: {
        actionCode: "TEST_ACTION",
      },
    });

    expect(response.res.statusCode).toBe(204);

    const outboxEntry = await outbox.findOne({
      "event.audit.entities.action": "PERFORM_PAGE_ACTION",
    });

    expect(outboxEntry).toMatchObject({
      event: {
        audit: {
          entities: [
            {
              entity: "CASE",
              action: "PERFORM_PAGE_ACTION",
              entityid: kase.caseRef,
            },
          ],
          status: "SUCCESS",
          details: {
            security: {
              actor: {
                id: expect.any(String),
                idpId: user.idpId,
                name: user.name,
                email: user.email,
                idpRoles: expect.arrayContaining([IdpRoles.ReadWrite]),
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
