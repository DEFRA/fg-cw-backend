import { describe, expect, it, vi } from "vitest";
import { PUBLIC_API_STRATEGY } from "../server/plugins/auth/public-api.js";
import { createServer } from "../server/index.js";
import { actuators } from "./index.js";

vi.mock("../common/mongo-client.js");

const registeredServer = async () => {
  const server = await createServer();

  await server.register(actuators);
  await server.initialize();

  return server;
};

describe("actuators", () => {
  it("registers the find-boxes route", async () => {
    const server = await registeredServer();

    expect(server.table().map((r) => r.path)).toContain("/actuators/boxes");
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
