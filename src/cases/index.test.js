import Hapi from "@hapi/hapi";
import { describe, expect, it } from "vitest";
import { cases } from "./index.js";
import { caseEvents } from "./routes/case-events.js";
import { casesRoutes } from "./routes/cases.js";
import { workflows } from "./routes/workflows.js";

describe("Router plugin tests", () => {
  it("should register all routes correctly", async () => {
    // Create a mock Hapi server
    const server = Hapi.server();
    await server.register(cases);

    // Verify that all routes are correctly registered
    const registeredRoutes = server.table();

    // Create lists of route paths from imported modules
    const expectedRoutes = [
      ...casesRoutes.map((r) => r.path),
      ...workflows.map((r) => r.path),
      ...caseEvents.map((r) => r.path),
    ];

    // Actual server's registered route paths
    const actualRoutes = registeredRoutes.map((route) => route.path);

    // Assert that all expected routes exist in registered routes
    expect(new Set(actualRoutes)).toEqual(new Set(expectedRoutes));
  });

  it("should register the router plugin itself", async () => {
    const server = Hapi.server();

    // Verify if the routes were registered by checking the server's table
    await server.register(cases);
    const registeredRoutes = server.table();

    // Assert that routes are registered (length > 0)
    expect(registeredRoutes.length).toBeGreaterThan(0);
  });
});
