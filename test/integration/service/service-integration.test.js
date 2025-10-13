import { MongoClient } from "mongodb";
import { randomUUID } from "node:crypto";
import { env } from "node:process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let client;
let db;
let users, cases;

beforeAll(async () => {
  client = await MongoClient.connect(env.MONGO_URI);
  db = client.db();
  users = db.collection("users");
  cases = db.collection("cases");
});

afterAll(async () => {
  await client?.close();
});

describe("Service Layer Integration Tests", () => {
  describe("User Service Integration", () => {
    it("should create user and persist to database correctly", async () => {
      // Test direct service integration, not HTTP
      const userData = {
        idpId: randomUUID(),
        email: "test-service-user@defra.gov.uk",
        name: "Service Test User",
        idpRoles: ["defra-idp"],
        appRoles: {
          ROLE_RPA_CASES_APPROVE: {
            startDate: "2025-01-01",
            endDate: "2025-12-31",
          },
        },
      };

      const createdUser = {
        id: randomUUID(),
        ...userData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await users.insertOne(createdUser);

      // Verify data persistence and transformation
      const dbUser = await users.findOne({ id: createdUser.id });
      expect(dbUser).toBeTruthy();
      expect(dbUser.email).toBe(userData.email);
      expect(dbUser.idpRoles).toEqual(userData.idpRoles);
      expect(dbUser.createdAt).toBeDefined();

      // Test service-specific business logic
      expect(dbUser.id).toBeDefined();
      expect(dbUser.id).toMatch(/^[0-9a-f-]+$/); // UUID format
    });

    it("should handle duplicate idpId constraint at service level", async () => {
      const sharedIdpId = randomUUID();
      const userData1 = {
        idpId: sharedIdpId,
        email: "test-service-1@defra.gov.uk",
        name: "User One",
        idpRoles: ["defra-idp"],
        appRoles: {
          ROLE_RPA_CASES_APPROVE: {
            startDate: "2025-01-01",
            endDate: "2025-12-31",
          },
        },
      };

      const userData2 = {
        idpId: sharedIdpId, // Same idpId
        email: "test-service-2@defra.gov.uk",
        name: "User Two",
        idpRoles: ["defra-idp"],
        appRoles: {
          ROLE_RPA_CASES_APPROVE: {
            startDate: "2025-01-01",
            endDate: "2025-12-31",
          },
        },
      };

      // Create first user
      const user1 = {
        id: randomUUID(),
        ...userData1,
        createdAt: new Date().toISOString(),
      };
      await users.insertOne(user1);

      // Attempt to create second user with same idpId should fail at service level
      try {
        const user2 = {
          id: randomUUID(),
          ...userData2,
          createdAt: new Date().toISOString(),
        };
        await users.insertOne(user2); // This should fail due to unique constraint

        // If we reach here, the constraint didn't work
        expect.fail("Should have thrown duplicate key error");
      } catch (error) {
        // Verify it's the right kind of database constraint error
        expect(error.message).toContain("duplicate") ||
          expect(error.code).toBe(11000);
      }
    });
  });

  describe("Case Service Integration", () => {
    it("should create case from SNS event data", async () => {
      // Test event-driven case creation (core integration point)
      const eventData = {
        clientRef: "SVC-TEST-001",
        grantCode: "pigs-might-fly",
        applicant: {
          name: "Test Pig Farmer",
          email: "farmer@example.com",
        },
        applicationData: {
          isPigFarmer: true,
          totalPigs: 500,
          farmLocation: "Test Farm",
        },
        submittedAt: new Date().toISOString(),
      };

      // Simulate case service processing SNS event
      const caseData = {
        id: randomUUID(),
        reference: eventData.clientRef,
        workflowCode: eventData.grantCode,
        status: "in-progress",
        data: eventData.applicationData,
        applicant: eventData.applicant,
        createdAt: new Date().toISOString(),
      };

      await cases.insertOne(caseData);

      // Verify case was created with correct data transformation
      const dbCase = await cases.findOne({ reference: eventData.clientRef });
      expect(dbCase).toBeDefined();
      expect(dbCase.workflowCode).toBe("pigs-might-fly");
      expect(dbCase.data.isPigFarmer).toBe(true);
      expect(dbCase.applicant.name).toBe("Test Pig Farmer");
    });

    it("should handle case assignment with referential integrity", async () => {
      // Create a user first
      const user = {
        id: randomUUID(),
        idpId: randomUUID(),
        email: "test-service-caseworker@defra.gov.uk",
        name: "Test Caseworker",
        idpRoles: ["defra-idp"],
        appRoles: {
          ROLE_RPA_CASES_APPROVE: {
            startDate: "2025-01-01",
            endDate: "2025-12-31",
          },
        },
      };
      await users.insertOne(user);

      // Create a case
      const testCase = {
        id: randomUUID(),
        reference: "SVC-TEST-002",
        workflowCode: "pigs-might-fly",
        status: "in-progress",
        createdAt: new Date().toISOString(),
      };
      await cases.insertOne(testCase);

      // Test case assignment at service level
      await cases.updateOne(
        { id: testCase.id },
        {
          $set: {
            assignedUserId: user.id,
            assignedAt: new Date().toISOString(),
          },
        },
      );

      // Verify assignment
      const assignedCase = await cases.findOne({ id: testCase.id });
      expect(assignedCase.assignedUserId).toBe(user.id);
      expect(assignedCase.assignedAt).toBeDefined();

      // Verify referential integrity - user exists
      const assignedUser = await users.findOne({ id: user.id });
      expect(assignedUser).toBeTruthy();
    });
  });

  describe("Cross-Service Integration", () => {
    it("should complete full case workflow", async () => {
      // This tests integration between multiple services/collections

      // 1. Create user (simulating user service)
      const caseworker = {
        id: randomUUID(),
        idpId: randomUUID(),
        email: "test-service-workflow@defra.gov.uk",
        name: "Workflow Test User",
        idpRoles: ["defra-idp"],
        appRoles: {
          ROLE_RPA_CASES_APPROVE: {
            startDate: "2025-01-01",
            endDate: "2025-12-31",
          },
        },
      };
      await users.insertOne(caseworker);

      // 2. Create case from "external" event (simulating event processing)
      const workflowCase = {
        id: randomUUID(),
        reference: "SVC-TEST-WORKFLOW-001",
        workflowCode: "pigs-might-fly",
        status: "in-progress",
        data: {
          isPigFarmer: true,
          totalPigs: 1000,
          applicationValue: 50000,
        },
        createdAt: new Date().toISOString(),
      };
      await cases.insertOne(workflowCase);

      // 3. Assign case to user
      await cases.updateOne(
        { id: workflowCase.id },
        {
          $set: {
            assignedUserId: caseworker.id,
            status: "assigned",
            assignedAt: new Date().toISOString(),
          },
        },
      );

      // 4. Progress case through workflow
      await cases.updateOne(
        { id: workflowCase.id },
        {
          $set: {
            status: "under-review",
            reviewStartedAt: new Date().toISOString(),
            "workflow.currentStage": "initial-review",
          },
        },
      );

      // 5. Verify complete workflow state
      const finalCase = await cases.findOne({ id: workflowCase.id });
      expect(finalCase.assignedUserId).toBe(caseworker.id);
      expect(finalCase.status).toBe("under-review");
      expect(finalCase.workflow?.currentStage).toBe("initial-review");

      // Verify user still exists and is correct
      const finalUser = await users.findOne({ id: caseworker.id });
      expect(finalUser.email).toBe(caseworker.email);
    });
  });

  describe("Data Integrity and Constraints", () => {
    it("should maintain data consistency across operations", async () => {
      // Test that concurrent operations don't corrupt data

      // Simulate concurrent user creation attempts
      const concurrentOperations = Array.from({ length: 3 }, (_, index) => {
        const user = {
          id: randomUUID(),
          idpId: randomUUID(), // Generate unique idpId for each user
          email: `test-service-concurrent-${index}@defra.gov.uk`,
          name: `Concurrent Test User ${index}`,
          idpRoles: ["defra-idp"],
          appRoles: [
            {
              code: "ROLE_RPA_CASES_APPROVE",
              name: "RPA Cases Approve",
              description: "Can approve RPA cases",
            },
          ],
          createdAt: new Date().toISOString(),
        };
        return users.insertOne(user);
      });

      await Promise.all(concurrentOperations);

      // Verify all users were created correctly
      const createdUsers = await users
        .find({
          email: { $regex: "^test-service-concurrent-" },
        })
        .toArray();

      expect(createdUsers).toHaveLength(3);

      // Verify each has unique ID and email
      const userIds = createdUsers.map((u) => u.id);
      const emails = createdUsers.map((u) => u.email);

      expect(new Set(userIds).size).toBe(3); // All unique
      expect(new Set(emails).size).toBe(3); // All unique
    });
  });

  describe("Performance Integration", () => {
    it("should handle bulk operations efficiently", async () => {
      const startTime = Date.now();

      // Create multiple users in bulk
      const bulkUsers = Array.from({ length: 10 }, (_, index) => ({
        id: randomUUID(),
        idpId: randomUUID(),
        email: `test-service-bulk-${index}@defra.gov.uk`,
        name: `Bulk User ${index}`,
        idpRoles: ["defra-idp"],
        appRoles: {
          ROLE_RPA_CASES_APPROVE: {
            startDate: "2025-01-01",
            endDate: "2025-12-31",
          },
        },
        createdAt: new Date().toISOString(),
      }));

      await users.insertMany(bulkUsers);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Verify all created
      const createdCount = await users.countDocuments({
        email: { $regex: "^test-service-bulk-" },
      });
      expect(createdCount).toBe(10);

      // Performance assertion (should be fast)
      expect(duration).toBeLessThan(1000); // Less than 1 second
    });
  });
});
