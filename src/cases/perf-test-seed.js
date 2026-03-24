/**
 * PERFORMANCE TEST DATA SEEDING
 *
 * This function clears and seeds test data for performance testing.
 * Only runs when PERF_TEST_SEED=true environment variable is set.
 *
 * Branch: hotfix/perf-test-seed (DO NOT MERGE TO MAIN)
 */

import { logger } from "../common/logger.js";

const clearCollections = async (db) => {
  logger.info("🗑️  Clearing collections...");

  await db.collection("cases").deleteMany({});
  logger.info("   ✓ Cleared cases");

  await db.collection("users").deleteMany({ _id: /^perf-test-user-/ });
  logger.info("   ✓ Cleared test users (kept service accounts)");

  await db.collection("workflows").deleteMany({});
  logger.info("   ✓ Cleared workflows");

  await db.collection("outbox").deleteMany({});
  logger.info("   ✓ Cleared outbox");

  await db.collection("inbox").deleteMany({});
  logger.info("   ✓ Cleared inbox");
};

const generateTestData = () => {
  const testUsers = [
    {
      _id: "perf-test-user-1",
      username: "perftest.caseworker",
      email: "perftest.caseworker@example.com",
      idpId: "perf-test-idp-caseworker",
      role: "caseworker",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      _id: "perf-test-user-2",
      username: "perftest.admin",
      email: "perftest.admin@example.com",
      idpId: "perf-test-idp-admin",
      role: "admin",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const testCases = [];
  for (let i = 0; i < 100; i++) {
    const clientRef = `perf-test-${String(i).padStart(3, "0")}`;
    const caseId = `case-${clientRef}`;

    testCases.push({
      _id: caseId,
      caseRef: clientRef,
      workflowCode: "frps-private-beta",
      currentPhase: "PRE_AWARD",
      currentStage: "REVIEW_APPLICATION",
      currentStatus: "APPLICATION_RECEIVED",
      assignedTo: "perf-test-user-1",
      identifiers: {
        sbi: `${107000000 + i}`,
        frn: `${1100000000 + i}`,
        crn: `${1100000000 + i}`,
      },
      data: {
        clientRef,
        eligibility: "yes",
        landArea: 100 + i,
      },
      history: [],
      notes: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  return { testUsers, testCases };
};

const insertTestData = async (db, testUsers, testCases) => {
  logger.info("📝 Seeding test data...");

  await db.collection("users").insertMany(testUsers);
  logger.info(`   ✓ Inserted ${testUsers.length} test users`);

  await db.collection("cases").insertMany(testCases);
  logger.info(`   ✓ Inserted ${testCases.length} test cases`);

  logger.info("✅ Performance test data seeding complete!");
  logger.info(`   Total cases: ${testCases.length}`);
  logger.info(
    `   Case refs: perf-test-000 to perf-test-${String(testCases.length - 1).padStart(3, "0")}`,
  );
  logger.info(`   Test users: ${testUsers.length}`);
};

export const seedPerfTestData = async (db) => {
  if (process.env.PERF_TEST_SEED !== "true") {
    return;
  }

  logger.info("🧹 Starting performance test data seeding...");
  logger.info("⚠️  This will CLEAR ALL DATA in the following collections:");
  logger.info("   - cases");
  logger.info("   - users (test users only, keeps service accounts)");
  logger.info("   - workflows");
  logger.info("   - outbox");
  logger.info("   - inbox");

  await clearCollections(db);
  const { testUsers, testCases } = generateTestData();
  await insertTestData(db, testUsers, testCases);
};
