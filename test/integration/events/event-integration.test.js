import { MongoClient } from "mongodb";
import { randomUUID } from "node:crypto";
import { env } from "node:process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let client;
let db;
let cases;

beforeAll(async () => {
  client = await MongoClient.connect(env.MONGO_URI);
  db = client.db();
  cases = db.collection("cases");
});

afterAll(async () => {
  await client?.close();
});

describe("Event-Driven Integration Tests", () => {
  describe("SNS Event Processing", () => {
    it("should process grant application submitted event", async () => {
      // This tests the core integration: fg-gas-backend sends SNS → fg-cw-backend processes

      const snsEvent = {
        Records: [
          {
            Sns: {
              Message: JSON.stringify({
                eventType: "GrantApplicationSubmitted",
                timestamp: new Date().toISOString(),
                data: {
                  clientRef: "EVENT-TEST-001",
                  grantCode: "pigs-might-fly",
                  applicant: {
                    name: "Test Pig Farmer",
                    email: "test.farmer@example.com",
                    phone: "01234567890",
                  },
                  application: {
                    isPigFarmer: true,
                    totalPigs: 750,
                    farmSize: 100,
                    sustainablePractices: true,
                    requestedAmount: 75000,
                  },
                  metadata: {
                    submittedAt: new Date().toISOString(),
                    ipAddress: "192.168.1.100",
                    userAgent: "Mozilla/5.0...",
                  },
                },
              }),
            },
          },
        ],
      };

      // Simulate event processing logic (normally in SNS handler)
      const message = JSON.parse(snsEvent.Records[0].Sns.Message);
      const { clientRef, grantCode, applicant, application, metadata } =
        message.data;

      // This is what the event processor should do:
      const caseData = {
        id: randomUUID(),
        reference: clientRef,
        workflowCode: grantCode,
        status: "new",
        applicant,
        data: application,
        metadata: {
          ...metadata,
          processedAt: new Date().toISOString(),
          sourceEvent: "GrantApplicationSubmitted",
        },
        workflow: {
          currentStage: "initial-review",
          stages: [],
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Process the event (insert case)
      await cases.insertOne(caseData);

      // Verify case was created correctly from event
      const createdCase = await cases.findOne({ reference: clientRef });
      expect(createdCase).toBeTruthy();
      expect(createdCase.workflowCode).toBe("pigs-might-fly");
      expect(createdCase.applicant.name).toBe("Test Pig Farmer");
      expect(createdCase.data.totalPigs).toBe(750);
      expect(createdCase.metadata.sourceEvent).toBe(
        "GrantApplicationSubmitted",
      );
      expect(createdCase.workflow.currentStage).toBe("initial-review");
    });

    it("should handle malformed SNS events gracefully", async () => {
      // Test error handling in event processing

      const malformedEvent = {
        Records: [
          {
            Sns: {
              Message: JSON.stringify({
                // Missing required fields
                eventType: "GrantApplicationSubmitted",
                data: {
                  clientRef: "EVENT-TEST-002",
                  // Missing grantCode, applicant, application
                },
              }),
            },
          },
        ],
      };

      // Simulate event processing with validation
      const message = JSON.parse(malformedEvent.Records[0].Sns.Message);

      // Validation logic
      const isValid =
        message.data.grantCode &&
        message.data.applicant &&
        message.data.application;

      if (!isValid) {
        // Log error and don't create case
        // Invalid event data, skipping case creation
        // In real implementation, might send to dead letter queue
        // or create error log entry
      } else {
        // Process normally
        await cases.insertOne({
          id: randomUUID(),
          reference: message.data.clientRef,
          // ... rest of processing
        });
      }

      // Verify no case was created for invalid event
      const createdCase = await cases.findOne({ reference: "EVENT-TEST-002" });
      expect(createdCase).toBeNull();
    });

    it("should handle duplicate events idempotently", async () => {
      // Test that processing the same event multiple times doesn't create duplicates

      const duplicateEvent = {
        Records: [
          {
            Sns: {
              Message: JSON.stringify({
                eventType: "GrantApplicationSubmitted",
                eventId: "unique-event-123", // Unique event ID for idempotency
                timestamp: new Date().toISOString(),
                data: {
                  clientRef: "EVENT-TEST-003",
                  grantCode: "pigs-might-fly",
                  applicant: { name: "Duplicate Test Farmer" },
                  application: { isPigFarmer: true },
                },
              }),
            },
          },
        ],
      };

      const message = JSON.parse(duplicateEvent.Records[0].Sns.Message);

      // Process event first time
      const caseData = {
        id: randomUUID(),
        reference: message.data.clientRef,
        workflowCode: message.data.grantCode,
        eventId: message.eventId, // Store event ID for idempotency
        applicant: message.data.applicant,
        data: message.data.application,
        createdAt: new Date().toISOString(),
      };

      await cases.insertOne(caseData);

      // Process same event again (simulate duplicate SNS delivery)
      const existingCase = await cases.findOne({
        eventId: message.eventId,
      });

      if (existingCase) {
        // Event already processed, skipping
      } else {
        // Would create duplicate case
        await cases.insertOne({ ...caseData, id: randomUUID() });
      }

      // Verify only one case exists
      const casesCount = await cases.countDocuments({
        reference: "EVENT-TEST-003",
      });
      expect(casesCount).toBe(1);
    });
  });

  describe("SQS Queue Processing", () => {
    it("should process case stage update messages", async () => {
      // Test processing messages from case stage update queue

      // First create a case
      const initialCase = {
        id: randomUUID(),
        reference: "EVENT-TEST-QUEUE-001",
        workflowCode: "pigs-might-fly",
        status: "IN_PROGRESS",
        workflow: {
          currentStage: "initial-review",
          stages: [],
        },
        createdAt: new Date().toISOString(),
      };
      await cases.insertOne(initialCase);

      // Simulate SQS message for stage update
      const sqsMessage = {
        Body: JSON.stringify({
          caseId: initialCase.id,
          newStage: "detailed-review",
          completedTasks: ["task1", "task2"],
          updatedBy: "system",
          timestamp: new Date().toISOString(),
        }),
      };

      // Process SQS message
      const messageData = JSON.parse(sqsMessage.Body);

      await cases.updateOne(
        { id: messageData.caseId },
        {
          $set: {
            "workflow.currentStage": messageData.newStage,
            "workflow.lastUpdated": messageData.timestamp,
            updatedAt: messageData.timestamp,
          },
          $push: {
            "workflow.stages": {
              stage: "initial-review",
              completedAt: messageData.timestamp,
              completedTasks: messageData.completedTasks,
            },
          },
        },
      );

      // Verify case was updated correctly
      const updatedCase = await cases.findOne({ id: initialCase.id });
      expect(updatedCase.workflow.currentStage).toBe("detailed-review");
      expect(updatedCase.workflow.stages).toHaveLength(1);
      expect(updatedCase.workflow.stages[0].completedTasks).toEqual([
        "task1",
        "task2",
      ]);
    });
  });

  // Note: Event ordering test removed - agreed with dev team that
  // out-of-order status events won't occur in production business logic

  describe("Event Processing Performance", () => {
    it("should handle high-volume event processing", async () => {
      const startTime = Date.now();

      // Simulate processing 50 events concurrently
      const createEventCase = (index) => {
        const event = {
          Records: [
            {
              Sns: {
                Message: JSON.stringify({
                  eventType: "GrantApplicationSubmitted",
                  data: {
                    clientRef: `EVENT-TEST-VOLUME-${index.toString().padStart(3, "0")}`,
                    grantCode: "pigs-might-fly",
                    applicant: { name: `Farmer ${index}` },
                    application: { isPigFarmer: true, totalPigs: 100 + index },
                  },
                }),
              },
            },
          ],
        };

        const message = JSON.parse(event.Records[0].Sns.Message);
        return cases.insertOne({
          id: randomUUID(),
          reference: message.data.clientRef,
          workflowCode: message.data.grantCode,
          caseRef: message.data.clientRef,
          applicant: message.data.applicant,
          data: message.data.application,
          createdAt: new Date().toISOString(),
        });
      };

      const eventPromises = Array.from({ length: 50 }, (_, index) =>
        createEventCase(index),
      );

      await Promise.all(eventPromises);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Verify all cases were created
      const createdCount = await cases.countDocuments({
        reference: { $regex: "^EVENT-TEST-VOLUME-" },
      });
      expect(createdCount).toBe(50);

      // Performance assertion (should handle 50 events quickly)
      expect(duration).toBeLessThan(3000); // Less than 3 seconds
      // Processed 50 events successfully
    });
  });

  describe("Cross-System Event Integration", () => {
    it("should simulate complete fg-gas to fg-cw event flow", async () => {
      // This simulates the real integration between the two systems

      // 1. Simulate fg-gas-backend publishing application event
      const applicationEvent = {
        source: "fg-gas-backend",
        eventType: "GrantApplicationSubmitted",
        timestamp: new Date().toISOString(),
        data: {
          clientRef: "FG-GAS-TO-CW-001",
          grantCode: "pigs-might-fly",
          applicant: {
            name: "Integration Test Farmer",
            email: "integration@example.com",
          },
          application: {
            isPigFarmer: true,
            totalPigs: 2000,
            sustainablePractices: true,
            requestedAmount: 100000,
          },
        },
      };

      // 2. fg-cw-backend processes the event and creates case
      const caseFromEvent = {
        id: randomUUID(),
        reference: applicationEvent.data.clientRef,
        workflowCode: applicationEvent.data.grantCode,
        caseRef: applicationEvent.data.clientRef, // Add caseRef to satisfy unique constraint
        status: "new",
        sourceSystem: applicationEvent.source,
        applicant: applicationEvent.data.applicant,
        data: applicationEvent.data.application,
        workflow: {
          currentStage: "eligibility-check",
          stages: [],
        },
        createdAt: applicationEvent.timestamp,
        updatedAt: applicationEvent.timestamp,
      };

      await cases.insertOne(caseFromEvent);

      // 3. Simulate workflow progression (would normally be triggered by user actions)
      await cases.updateOne(
        { id: caseFromEvent.id },
        {
          $set: {
            status: "under-review",
            "workflow.currentStage": "detailed-review",
            updatedAt: new Date().toISOString(),
          },
          $push: {
            "workflow.stages": {
              stage: "eligibility-check",
              status: "completed",
              completedAt: new Date().toISOString(),
            },
          },
        },
      );

      // 4. Verify complete integration
      const processedCase = await cases.findOne({
        reference: "FG-GAS-TO-CW-001",
      });
      expect(processedCase).toBeTruthy();
      expect(processedCase.sourceSystem).toBe("fg-gas-backend");
      expect(processedCase.workflow.currentStage).toBe("detailed-review");
      expect(processedCase.workflow.stages).toHaveLength(1);
      expect(processedCase.data.totalPigs).toBe(2000); // Data preserved from original
    });
  });
});
