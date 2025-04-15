import { describe, expect, it } from "vitest";
import Hapi from "@hapi/hapi";
import { router } from "./router.js"; // Adjust the path to router.js if needed
import { health } from "../route/health.js";
import { workflows } from "../route/workflows.js";
import { cases } from "../route/cases.js";
import { caseEvents } from "../route/case-events.js";

describe("Router plugin tests", () => {
  it("should register all routes correctly", async () => {
    // Create a mock Hapi server
    const server = Hapi.server();
    await server.register(router.plugin);

    // Verify that all routes are correctly registered
    const registeredRoutes = server.table();

    // Create lists of route paths from imported modules
    const expectedRoutes = [
      ...[health].map((r) => r.path),
      ...cases.map((r) => r.path),
      ...workflows.map((r) => r.path),
      ...caseEvents.map((r) => r.path)
    ];

    // Actual server's registered route paths
    const actualRoutes = registeredRoutes.map((route) => route.path);

    // Assert that all expected routes exist in registered routes
    expect(new Set(actualRoutes)).toEqual(new Set(expectedRoutes));
  });

  it("should register the router plugin itself", async () => {
    const server = Hapi.server();

    // Verify if the routes were registered by checking the server's table
    await server.register(router.plugin);
    const registeredRoutes = server.table();

    // Assert that routes are registered (length > 0)
    expect(registeredRoutes.length).toBeGreaterThan(0);
  });
});
