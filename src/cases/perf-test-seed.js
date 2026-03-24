/**
 * PERFORMANCE TEST DATA SEEDING
 *
 * This function clears test data for performance testing.
 * Only runs when PERF_TEST_SEED=true environment variable is set.
 *
 * Cases are NOT created here - they will be created automatically when
 * GAS backend sends CreateNewCaseCommand messages via SQS.
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

  await db.collection("outbox").deleteMany({});
  logger.info("   ✓ Cleared outbox");

  await db.collection("inbox").deleteMany({});
  logger.info("   ✓ Cleared inbox");
};

const cleanupIncompleteWorkflow = async (db) => {
  const workflow = await db
    .collection("workflows")
    .findOne({ code: "frps-private-beta" });

  if (!workflow) {
    return;
  }

  const workflowStr = JSON.stringify(workflow);
  const hasTheme = workflowStr.includes('"theme"');

  if (!hasTheme) {
    logger.info("🔧 Removing incomplete workflow (missing themes)...");
    await db.collection("workflows").deleteOne({ code: "frps-private-beta" });
    await db.collection("changelog").deleteMany({ fileName: /frps/ });
    logger.info("   ✓ Incomplete workflow removed, migrations will re-run");
  }
};

const createTestUsers = async (db) => {
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

  await db.collection("users").insertMany(testUsers);
  logger.info(`   ✓ Created ${testUsers.length} test users`);
};

export const seedPerfTestData = async (db) => {
  if (process.env.PERF_TEST_SEED !== "true") {
    return;
  }

  // One-time cleanup: Delete incomplete workflow if it exists without themes
  await cleanupIncompleteWorkflow(db);

  // Check if data already seeded (prevents race conditions with multiple pods)
  const existing = await db
    .collection("users")
    .countDocuments({ _id: /^perf-test-user-/ });

  if (existing > 0) {
    logger.info(
      "⏭️  Perf test data already seeded, skipping (found existing data)",
    );
    return;
  }

  logger.info("🧹 Starting performance test data seeding...");
  logger.info("⚠️  This will CLEAR ALL DATA in the following collections:");
  logger.info("   - cases");
  logger.info("   - users (test users only, keeps service accounts)");
  logger.info("   - outbox");
  logger.info("   - inbox");
  logger.info("");
  logger.info(
    "ℹ️  Cases will be created automatically via SQS from GAS backend",
  );

  await clearCollections(db);
  await createTestUsers(db);

  logger.info("✅ Performance test data seeding complete!");
  logger.info(
    "   Waiting for cases to be created via SQS from GAS applications...",
  );
};
