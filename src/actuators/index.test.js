import { beforeEach, describe, expect, it, vi } from "vitest";
import { operatorHeaders } from "../../test/helpers/operator.js";
import { getRequestContext } from "../common/request-context.js";
import { CASE_READER_CLIENT } from "../common/require-case-reader.js";
import { OTHER } from "../events/event-purge.js";
import { createServer } from "../server/index.js";
import { PUBLIC_API_STRATEGY } from "../server/plugins/auth/public-api.js";
import { users } from "../users/index.js";
import { findUserRolesUseCase } from "../users/use-cases/find-user-roles.use-case.js";
import { actuators } from "./index.js";
import { eventIdParams } from "./schemas/event-id.schema.js";
import { editInboxEventPayloadUseCase } from "./use-cases/edit-inbox-event-payload.use-case.js";
import { editOutboxEventPayloadUseCase } from "./use-cases/edit-outbox-event-payload.use-case.js";
import { getInboxEventUseCase } from "./use-cases/get-inbox-event.use-case.js";
import { getOutboxEventUseCase } from "./use-cases/get-outbox-event.use-case.js";
import { purgeInboxEventUseCase } from "./use-cases/purge-inbox-event.use-case.js";
import { purgeOutboxEventUseCase } from "./use-cases/purge-outbox-event.use-case.js";
import { redriveInboxEventUseCase } from "./use-cases/redrive-inbox-event.use-case.js";
import { redriveOutboxEventUseCase } from "./use-cases/redrive-outbox-event.use-case.js";

vi.mock("../common/mongo-client.js");
vi.mock("../users/use-cases/find-user-roles.use-case.js");
vi.mock("./use-cases/edit-inbox-event-payload.use-case.js");
vi.mock("./use-cases/edit-outbox-event-payload.use-case.js");
vi.mock("./use-cases/get-inbox-event.use-case.js");
vi.mock("./use-cases/get-outbox-event.use-case.js");
vi.mock("./use-cases/purge-inbox-event.use-case.js");
vi.mock("./use-cases/purge-outbox-event.use-case.js");
vi.mock("./use-cases/redrive-inbox-event.use-case.js");
vi.mock("./use-cases/redrive-outbox-event.use-case.js");

const registeredServer = async () => {
  const server = await createServer();

  await server.register(actuators);
  await server.initialize();

  return server;
};

describe("actuators", () => {
  it("registers the bucket, dead letter, event, case, workflow version and client routes", async () => {
    const server = await registeredServer();

    const actuatorPaths = server
      .table()
      .map((route) => route.path)
      .filter((path) => path.startsWith("/actuators"))
      .sort();

    expect(actuatorPaths).toEqual([
      "/actuators/buckets",
      "/actuators/buckets/{bucketId}/query",
      "/actuators/buckets/{bucketId}/summaries/{summaryId}",
      "/actuators/cases/{workflowCode}/{caseRef}",
      "/actuators/cases/{workflowCode}/{caseRef}/existence",
      "/actuators/clients",
      "/actuators/clients/{clientId}/tokens",
      "/actuators/clients/{clientId}/tokens/{tokenId}",
      "/actuators/clients/{clientId}/tokens/{tokenId}/expiry",
      "/actuators/clients/{clientId}/tokens/{tokenId}/revoke",
      "/actuators/clients/{clientId}/tokens/{tokenId}/rotate",
      "/actuators/dead-letters",
      "/actuators/events/inbox/{id}",
      "/actuators/events/inbox/{id}/payload",
      "/actuators/events/inbox/{id}/purge",
      "/actuators/events/inbox/{id}/redrive",
      "/actuators/events/outbox/{id}",
      "/actuators/events/outbox/{id}/payload",
      "/actuators/events/outbox/{id}/purge",
      "/actuators/events/outbox/{id}/redrive",
      "/actuators/timeline",
      "/actuators/workflows/{code}/versions",
      "/actuators/workflows/{code}/versions/{version}",
      "/actuators/workflows/{code}/versions/{version}/existence",
      "/actuators/workflows/{code}/versions/{version}/fetch",
    ]);
  });

  // The list endpoints the bucket routes replaced. Asserted absent rather than
  // merely unlisted: they were a service-token API surface, and a retirement
  // nobody notices is one that quietly comes back.
  it.each([
    "/actuators/events",
    "/actuators/cases/search",
    "/actuators/inbox",
    "/actuators/outbox",
    "/actuators/inbox/counts",
    "/actuators/outbox/counts",
    "/actuators/inbox/breakdown",
    "/actuators/outbox/breakdown",
  ])("no longer answers %s", async (path) => {
    const server = await registeredServer();

    expect(server.table().map((r) => r.path)).not.toContain(path);
  });

  it("still routes a 24-hex id to the detail route", async () => {
    const server = await registeredServer();

    expect(
      server.match("get", "/actuators/events/inbox/665f1c2e9a1b2c3d4e5f6a7b")
        .path,
    ).toBe("/actuators/events/inbox/{id}");
  });

  it("routes a version's existence and its fetch apart", async () => {
    const server = await registeredServer();
    const version = "/actuators/workflows/woodland/versions/1.2.0";

    expect(server.match("get", `${version}/existence`).path).toBe(
      "/actuators/workflows/{code}/versions/{version}/existence",
    );
    expect(server.match("post", `${version}/fetch`).path).toBe(
      "/actuators/workflows/{code}/versions/{version}/fetch",
    );
  });

  // The `/actuators/events` prefix put the collection and its members on
  // different depths, so no literal can be read as an id any more. The id
  // constraint that made the retired `/counts` and `/breakdown` paths safe is
  // kept anyway: it is what keeps a word out of the detail route at all.
  it("could not accept a word where an id belongs", () => {
    expect(eventIdParams.validate({ id: "events" }).error).toBeDefined();
    expect(eventIdParams.validate({ id: "counts" }).error).toBeDefined();
  });

  it("keeps every /actuators/* route on the public API strategy", async () => {
    const server = await registeredServer();

    const routes = server
      .table()
      .filter((r) => r.path.startsWith("/actuators"));

    expect(routes.length).toBeGreaterThan(0);

    for (const route of routes) {
      expect(route.settings.auth.strategies).toEqual([PUBLIC_API_STRATEGY]);
    }
  });

  // Over the routes the server holds, not a list, so an actuator added later
  // is covered without anyone remembering to add it here.
  describe("the client guard", () => {
    const EVENT_ID = "665f1c2e9a1b2c3d4e5f6a7b";

    let server;
    let handled;
    let auditUser;

    const as = (service, { method, path, payload }) =>
      server.inject({
        method,
        url: path,
        headers: operatorHeaders,
        payload,
        auth: { strategy: PUBLIC_API_STRATEGY, credentials: { service } },
      });

    const sampleUrl = (path) =>
      path.replace("{id}", EVENT_ID).replaceAll(/\{\w+\}/g, "x");

    beforeEach(async () => {
      server = await createServer();
      await server.register([users, actuators]);

      handled = vi.fn();
      auditUser = vi.fn();
      server.ext("onPreHandler", (request, h) => {
        handled(request.path);
        return h.continue;
      });
      server.ext("onPreResponse", (request, h) => {
        auditUser(getRequestContext()?.user);
        return h.continue;
      });

      await server.initialize();
    });

    const actuatorRoutes = () => {
      const routes = server
        .table()
        .filter((r) => r.path.startsWith("/actuators"));

      expect(routes.length).toBeGreaterThan(0);

      return routes;
    };

    it.each(["test-client", "fg-grants-platform-admin", undefined])(
      "refuses %s on every actuator before it is handled",
      async (service) => {
        const routes = actuatorRoutes();

        for (const route of routes) {
          const response = await as(service, {
            method: route.method,
            path: sampleUrl(route.path),
            payload: route.method === "post" ? {} : undefined,
          });

          expect(response.statusCode, route.path).toBe(403);
        }

        expect(handled).not.toHaveBeenCalled();
        expect(auditUser).toHaveBeenCalledTimes(routes.length);
        expect(auditUser.mock.calls.flat().filter(Boolean)).toEqual([]);
      },
    );

    it.each([
      ["get", "inbox", "", getInboxEventUseCase, 200],
      ["get", "outbox", "", getOutboxEventUseCase, 200],
      ["post", "inbox", "/redrive", redriveInboxEventUseCase, 204],
      ["post", "outbox", "/redrive", redriveOutboxEventUseCase, 204],
      ["post", "inbox", "/purge", purgeInboxEventUseCase, 204],
      ["post", "outbox", "/purge", purgeOutboxEventUseCase, 204],
      ["post", "inbox", "/payload", editInboxEventPayloadUseCase, 200],
      ["post", "outbox", "/payload", editOutboxEventPayloadUseCase, 200],
    ])(
      "still answers fg-gas-backend on %s /actuators/events/%s/{id}%s",
      async (method, box, action, useCase, statusCode) => {
        useCase.mockResolvedValue(
          action === "/payload"
            ? {
                payloadRevision: 1,
                changedPaths: ["/a"],
                changedPathsTruncated: false,
              }
            : { _id: EVENT_ID },
        );
        const payloads = {
          "/purge": { reasonCode: OTHER, note: "Sent twice" },
          "/payload": { payload: { a: 1 }, note: "Fixed", revision: 0 },
        };

        const response = await as(CASE_READER_CLIENT, {
          method,
          path: `/actuators/events/${box}/${EVENT_ID}${action}${method === "post" ? "?by=Jane" : ""}`,
          payload: payloads[action],
        });

        expect(response.statusCode).toBe(statusCode);
        expect(useCase).toHaveBeenCalledOnce();
        expect(auditUser).toHaveBeenCalledWith(operatorHeaders["x-actor-id"]);
      },
    );

    it("leaves the user roles route open to any service client", async () => {
      findUserRolesUseCase.mockResolvedValue({ appRoles: [] });

      const response = await as("test-client", {
        method: "get",
        path: "/api/users/123e4567-e89b-12d3-a456-426614174000/roles",
      });

      expect(response.statusCode).toBe(200);
      expect(findUserRolesUseCase).toHaveBeenCalledOnce();
    });
  });
});
