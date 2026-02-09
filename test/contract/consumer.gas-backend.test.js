// test/contract/consumer.gas-backend.test.js
// Consumer test: fg-cw-backend consumes messages FROM fg-gas-backend
//
// ⚠️ CRITICAL FIELDS ⚠️
//
// CreateNewCaseCommand: Our code expects (src/cases/use-cases/create-case.use-case.js):
//   - data.caseRef: Primary key for case creation (required)
//   - data.workflowCode: Workflow validation (required)
//   - data.payload.identifiers: { sbi, frn, crn, defraId } - stored on case
//   - data.payload.answers: Application form data - validated against workflow schema
//   - data.payload.createdAt, submittedAt: Timestamps
//
// UpdateCaseStatusCommand: Our code expects (src/cases/use-cases/progress-case.use-case.js):
//   - data.caseRef: For case lookup (required)
//   - data.workflowCode: For validation (required)
//   - data.newStatus: Must be in format "PHASE:STAGE:STATUS" (required)
//   - data.supplementaryData: Optional complex data to attach
//     - targetNode: Where to store (e.g., "agreements")
//     - dataType: "ARRAY" or "OBJECT"
//     - data: The actual data to store
//
import { MatchersV2, MessageConsumerPact } from "@pact-foundation/pact";
import path from "path";
import { describe, expect, it } from "vitest";

const { like, uuid, iso8601DateTimeWithMillis, term } = MatchersV2;

describe("fg-cw-backend Consumer (receives messages from fg-gas-backend)", () => {
  const messagePact = new MessageConsumerPact({
    consumer: "fg-cw-backend",
    provider: "fg-gas-backend",
    dir: path.resolve(process.cwd(), "tmp/pacts"),
    logLevel: "info",
  });

  describe("CreateNewCaseCommand Message", () => {
    it("should accept a create new case command from GAS", async () => {
      await messagePact
        .expectsToReceive("a create new case command from GAS")
        .withContent({
          // CloudEvent fields
          id: uuid("12345678-1234-1234-1234-123456789001"),

          // Type must match routing map in inbox.subscriber.js
          type: term({
            generate: "cloud.defra.test.fg-gas-backend.case.create",
            matcher:
              "^cloud\\.defra\\.(test|local|prod)\\.fg-gas-backend\\.case\\.create$",
          }),

          source: "fg-gas-backend", // Exact - used for routing
          specVersion: "1.0", // Exact - CloudEvents spec constant
          datacontenttype: "application/json", // Exact - constant
          time: iso8601DateTimeWithMillis("2025-02-09T12:00:00.000Z"),
          traceparent: like("00-trace-id"), // Used for distributed tracing

          // Data fields
          data: {
            // CRITICAL: caseRef is the primary identifier
            // Used as unique constraint in case creation
            caseRef: like("CASE-REF-001"),

            // CRITICAL: workflowCode must match configured workflow
            // Invalid workflow code will cause validation failure
            workflowCode: like("frps-private-beta"),

            // CRITICAL: payload contains all application data
            payload: {
              // Timestamps
              createdAt: iso8601DateTimeWithMillis("2025-02-09T11:00:00.000Z"),
              submittedAt: iso8601DateTimeWithMillis(
                "2025-02-09T12:00:00.000Z",
              ),

              // CRITICAL: identifiers used for case lookup and downstream APIs
              // Missing any of these will cause data loss
              identifiers: {
                sbi: like("SBI001"), // Single Business Identifier
                frn: like("FIRM0001"), // Farmer Reference Number
                crn: like("CUST0001"), // Customer Reference Number
                defraId: like("DEFRA0001"), // Optional but expected
              },

              // Application form answers - flexible structure
              // Validated against workflow schema, not in pact
              answers: like({
                scheme: "SFI",
                year: 2025,
                hasCheckedLandIsUpToDate: true,
              }),

              // Optional metadata
              metadata: like({}),
            },
          },
        })
        .withMetadata({
          contentType: "application/json",
        })
        .verify(async (message) => {
          const cloudEvent = message.contents;

          // Verify critical fields are present
          expect(cloudEvent.data.caseRef).toBeDefined();
          expect(cloudEvent.data.workflowCode).toBeDefined();
          expect(cloudEvent.data.payload).toBeDefined();
          expect(cloudEvent.data.payload.identifiers).toBeDefined();
          expect(cloudEvent.data.payload.identifiers.sbi).toBeDefined();
          expect(cloudEvent.data.payload.identifiers.frn).toBeDefined();
          expect(cloudEvent.data.payload.identifiers.crn).toBeDefined();
        });
    });
  });

  describe("UpdateCaseStatusCommand Message", () => {
    it("should accept a case status update command from GAS", async () => {
      await messagePact
        .expectsToReceive("a case status update command from GAS")
        .withContent({
          // CloudEvent fields
          id: uuid("12345678-1234-1234-1234-123456789002"),

          // Type must match routing map
          type: term({
            generate: "cloud.defra.test.fg-gas-backend.case.update.status",
            matcher:
              "^cloud\\.defra\\.(test|local|prod)\\.fg-gas-backend\\.case\\.update\\.status$",
          }),

          source: "fg-gas-backend", // Exact
          specVersion: "1.0", // Exact
          datacontenttype: "application/json", // Exact
          time: iso8601DateTimeWithMillis("2025-02-09T12:00:00.000Z"),
          traceparent: like("00-trace-id"),

          // Data fields
          data: {
            // CRITICAL: caseRef for case lookup
            caseRef: like("CASE-REF-001"),

            // CRITICAL: workflowCode for validation
            workflowCode: like("frps-private-beta"),

            // CRITICAL: newStatus must be in fully qualified format
            // CW validates this against workflow configuration
            // Format: "PHASE:STAGE:STATUS"
            newStatus: term({
              generate: "PRE_AWARD:ASSESSMENT:IN_REVIEW",
              matcher: "^[A-Z_]+:[A-Z_]+:[A-Z_]+$",
            }),

            // Optional: supplementaryData for attaching additional data
            // Structure matters - wrong structure will cause data corruption
            supplementaryData: like({
              phase: "PRE_AWARD",
              stage: "ASSESSMENT",
              targetNode: "agreements", // Where to store the data
              dataType: "ARRAY", // Type of data
              data: [
                // Array of data to store
                {
                  agreementRef: "AGR-001",
                  createdAt: "2023-10-01T12:00:00Z",
                  updatedAt: "2023-10-01T12:00:00Z",
                  agreementStatus: "OFFER",
                },
              ],
            }),
          },
        })
        .withMetadata({
          contentType: "application/json",
        })
        .verify(async (message) => {
          const cloudEvent = message.contents;

          // Verify critical fields
          expect(cloudEvent.data.caseRef).toBeDefined();
          expect(cloudEvent.data.workflowCode).toBeDefined();
          expect(cloudEvent.data.newStatus).toBeDefined();
          expect(cloudEvent.data.newStatus).toMatch(
            /^[A-Z_]+:[A-Z_]+:[A-Z_]+$/,
          );

          // supplementaryData is optional, but if present, should have structure
          if (cloudEvent.data.supplementaryData) {
            expect(cloudEvent.data.supplementaryData).toBeTypeOf("object");
          }
        });
    });
  });
});
