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
  let client;
  let externalAction;
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
      ],
      endpoints: [
        {
          code: "TEST_ENDPOINT",
          service: "TEST_EXTERNAL_SERVICE",
          path: "/do-some-work",
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

    expect(updatedCase.supplementaryData.output).toEqual([
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

    // Verify timeline event was created for the external action with display: true
    const timelineEvent = updatedCase.timeline.find(
      (event) => event.eventType === "EXTERNAL_ACTION_TRIGGERED",
    );
    expect(timelineEvent).toBeDefined();
    expect(timelineEvent.data.actionName).toBe("Perform action");
    expect(timelineEvent.description).toBe("Action - Perform action");
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
});
