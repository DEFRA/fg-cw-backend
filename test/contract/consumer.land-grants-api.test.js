// test/contract/consumer.land-grants-api.test.js
// Consumer test: fg-cw-backend calls land-grants-api HTTP endpoints
//
// Endpoints:
// 1. GET /case-management-adapter/application/validation-run/{id}
//    - Fetches validation run results by ID
//    - Returns structured validation data as UI components
//
// 2. POST /case-management-adapter/application/validation-run/rerun
//    - Reruns validation for an application
//    - Returns validation result with pass/fail status
//
import { MatchersV3, PactV3 } from "@pact-foundation/pact";
import path from "path";
import { describe, expect, it } from "vitest";

const { like, eachLike, integer, boolean } = MatchersV3;

// TODO: Re-enable once land-grants-api implements provider side (Andy Timney's team)
// See COORDINATION_MESSAGE_LAND_GRANTS_API.md for implementation instructions
describe.skip("fg-cw-backend Consumer (calls land-grants-api HTTP endpoints)", () => {
  const provider = new PactV3({
    consumer: "fg-cw-backend",
    provider: "land-grants-api",
    dir: path.resolve(process.cwd(), "tmp/pacts"),
    logLevel: "info",
  });

  describe("GET /case-management-adapter/application/validation-run/{id}", () => {
    it("should retrieve validation run results by ID", async () => {
      await provider
        .given("has validation run with id 123")
        .uponReceiving("a request to fetch validation run 123")
        .withRequest({
          method: "GET",
          path: "/case-management-adapter/application/validation-run/123",
          headers: {
            "Content-Type": "application/json",
          },
        })
        .willRespondWith({
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
          body: {
            message: like("Application validation run retrieved successfully"),
            response: eachLike({
              component: like("paragraph"),
              text: like("Validation result text"),
            }),
          },
        });

      await provider.executeTest(async (mockServer) => {
        // Mock the external endpoint call
        const response = await fetch(
          `${mockServer.url}/case-management-adapter/application/validation-run/123`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          },
        );

        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.message).toBeDefined();
        expect(data.response).toBeInstanceOf(Array);
        expect(data.response.length).toBeGreaterThan(0);
        expect(data.response[0]).toHaveProperty("component");
        expect(data.response[0]).toHaveProperty("text");
      });
    });

    it("should return 404 when validation run not found", async () => {
      await provider
        .given("has no validation run with id 999")
        .uponReceiving("a request to fetch non-existent validation run 999")
        .withRequest({
          method: "GET",
          path: "/case-management-adapter/application/validation-run/999",
          headers: {
            "Content-Type": "application/json",
          },
        })
        .willRespondWith({
          status: 404,
          headers: {
            "Content-Type": "application/json",
          },
          body: {
            statusCode: 404,
            error: like("Not Found"),
            message: like("Application validation run not found"),
          },
        });

      await provider.executeTest(async (mockServer) => {
        const response = await fetch(
          `${mockServer.url}/case-management-adapter/application/validation-run/999`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          },
        );

        const data = await response.json();

        expect(response.status).toBe(404);
        expect(data.statusCode).toBe(404);
        expect(data.error).toBeDefined();
        expect(data.message).toBeDefined();
      });
    });
  });

  describe("POST /case-management-adapter/application/validation-run/rerun", () => {
    it("should successfully rerun validation for an application", async () => {
      await provider
        .given("has application validation run with id 123")
        .uponReceiving("a request to rerun validation for application 123")
        .withRequest({
          method: "POST",
          path: "/case-management-adapter/application/validation-run/rerun",
          headers: {
            "Content-Type": "application/json",
          },
          body: {
            id: 123,
            requesterUsername: like("CASEWORKING_SYSTEM"),
          },
        })
        .willRespondWith({
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
          body: {
            message: like("Application validated successfully"),
            valid: boolean(),
            id: integer(),
            date: like("2025-09-30T08:29:21.263Z"),
          },
        });

      await provider.executeTest(async (mockServer) => {
        const response = await fetch(
          `${mockServer.url}/case-management-adapter/application/validation-run/rerun`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              id: 123,
              requesterUsername: "CASEWORKING_SYSTEM",
            }),
          },
        );

        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.message).toBeDefined();
        expect(data.valid).toBeDefined();
        expect(typeof data.valid).toBe("boolean");
        expect(data.id).toBeDefined();
        expect(typeof data.id).toBe("number");
        expect(data.date).toBeDefined();
        expect(typeof data.date).toBe("string");
      });
    });

    it("should return 404 when application validation run not found for rerun", async () => {
      await provider
        .given("has no application validation run with id 999")
        .uponReceiving(
          "a request to rerun validation for non-existent application 999",
        )
        .withRequest({
          method: "POST",
          path: "/case-management-adapter/application/validation-run/rerun",
          headers: {
            "Content-Type": "application/json",
          },
          body: {
            id: 999,
            requesterUsername: like("CASEWORKING_SYSTEM"),
          },
        })
        .willRespondWith({
          status: 404,
          headers: {
            "Content-Type": "application/json",
          },
          body: {
            statusCode: 404,
            error: like("Not Found"),
            message: like("Application validation run not found"),
          },
        });

      await provider.executeTest(async (mockServer) => {
        const response = await fetch(
          `${mockServer.url}/case-management-adapter/application/validation-run/rerun`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              id: 999,
              requesterUsername: "CASEWORKING_SYSTEM",
            }),
          },
        );

        const data = await response.json();

        expect(response.status).toBe(404);
        expect(data.statusCode).toBe(404);
        expect(data.error).toBeDefined();
        expect(data.message).toBeDefined();
      });
    });

    it("should return 400 when validation fails with errors", async () => {
      await provider
        .given("has application validation run with id 456 that will fail")
        .uponReceiving(
          "a request to rerun validation that produces validation errors",
        )
        .withRequest({
          method: "POST",
          path: "/case-management-adapter/application/validation-run/rerun",
          headers: {
            "Content-Type": "application/json",
          },
          body: {
            id: 456,
            requesterUsername: like("CASEWORKING_SYSTEM"),
          },
        })
        .willRespondWith({
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
          body: {
            statusCode: 400,
            error: like("Bad Request"),
            message: like("Validation error"),
          },
        });

      await provider.executeTest(async (mockServer) => {
        const response = await fetch(
          `${mockServer.url}/case-management-adapter/application/validation-run/rerun`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              id: 456,
              requesterUsername: "CASEWORKING_SYSTEM",
            }),
          },
        );

        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.statusCode).toBe(400);
        expect(data.error).toBeDefined();
        expect(data.message).toBeDefined();
      });
    });
  });
});
