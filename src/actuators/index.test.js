import { describe, expect, it, vi } from "vitest";
import { createServer } from "../server/index.js";
import { PUBLIC_API_STRATEGY } from "../server/plugins/auth/public-api.js";
import { actuators } from "./index.js";
import { eventIdParams } from "./schemas/event-id.schema.js";

vi.mock("../common/mongo-client.js");

const registeredServer = async () => {
  const server = await createServer();

  await server.register(actuators);
  await server.initialize();

  return server;
};

describe("actuators", () => {
  it("registers the inbox and outbox list, detail and redrive routes", async () => {
    const server = await registeredServer();

    expect(server.table().map((r) => r.path)).toEqual(
      expect.arrayContaining([
        "/actuators/inbox",
        "/actuators/outbox",
        "/actuators/inbox/{id}",
        "/actuators/outbox/{id}",
        "/actuators/inbox/{id}/redrive",
        "/actuators/outbox/{id}/redrive",
        "/actuators/inbox/counts",
        "/actuators/outbox/counts",
        "/actuators/inbox/breakdown",
        "/actuators/outbox/breakdown",
        "/actuators/inbox/{id}/park",
        "/actuators/outbox/{id}/park",
        "/actuators/inbox/{id}/unpark",
        "/actuators/outbox/{id}/unpark",
      ]),
    );
  });

  // `/actuators/inbox/counts` and `/actuators/inbox/{id}` differ only in their
  // last segment, so this asserts the conflict is actually resolved rather
  // than trusting hapi's ordering rules.
  it("routes /actuators/{box}/counts to the counts route, not the {id} route", async () => {
    const server = await registeredServer();

    for (const box of ["inbox", "outbox"]) {
      expect(server.match("get", `/actuators/${box}/counts`).path).toBe(
        `/actuators/${box}/counts`,
      );
    }
  });

  it("still routes a 24-hex id to the detail route", async () => {
    const server = await registeredServer();

    expect(
      server.match("get", "/actuators/inbox/665f1c2e9a1b2c3d4e5f6a7b").path,
    ).toBe("/actuators/inbox/{id}");
  });

  // `/actuators/inbox/breakdown` has exactly the same shape of conflict with
  // `/actuators/inbox/{id}`, so it gets exactly the same proof.
  it("routes /actuators/{box}/breakdown to the breakdown route, not the {id} route", async () => {
    const server = await registeredServer();

    for (const box of ["inbox", "outbox"]) {
      expect(server.match("get", `/actuators/${box}/breakdown`).path).toBe(
        `/actuators/${box}/breakdown`,
      );
    }
  });

  it("routes park and unpark to their own routes, not to redrive", async () => {
    const server = await registeredServer();
    const id = "665f1c2e9a1b2c3d4e5f6a7b";

    for (const box of ["inbox", "outbox"]) {
      expect(server.match("post", `/actuators/${box}/${id}/park`).path).toBe(
        `/actuators/${box}/{id}/park`,
      );
      expect(server.match("post", `/actuators/${box}/${id}/unpark`).path).toBe(
        `/actuators/${box}/{id}/unpark`,
      );
    }
  });

  it('could not accept "counts" or "breakdown" as an id even if it reached the detail route', () => {
    expect(eventIdParams.validate({ id: "counts" }).error).toBeDefined();
    expect(eventIdParams.validate({ id: "breakdown" }).error).toBeDefined();
  });

  it("registers the counts and breakdown routes before the {id} routes", async () => {
    const server = await registeredServer();
    const paths = server.table().map((route) => route.path);

    expect(paths.indexOf("/actuators/inbox/counts")).toBeLessThan(
      paths.indexOf("/actuators/inbox/{id}"),
    );
    expect(paths.indexOf("/actuators/inbox/breakdown")).toBeLessThan(
      paths.indexOf("/actuators/inbox/{id}"),
    );
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
});
