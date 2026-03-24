/**
 * PERFORMANCE TEST DATA SEEDING MIGRATION
 *
 * ⚠️ WARNING: This migration is ONLY for performance testing environments
 * It will CLEAR ALL DATA and populate test data
 *
 * Usage:
 *   PERF_TEST_SEED=true npm run migrate:perf-test
 *
 * Safety:
 *   - Requires PERF_TEST_SEED=true environment variable
 *   - Will NOT run in production or normal deployments
 *   - Timestamp 99999999999999 ensures it runs last
 *
 * Branch: hotfix/perf-test-seed (DO NOT MERGE TO MAIN)
 */

export const up = async (db) => {
  // Safety check: Require explicit opt-in
  if (process.env.PERF_TEST_SEED !== "true") {
    console.log("⏭️  Skipping perf test seed (PERF_TEST_SEED not set)");
    return;
  }

  // Delete own changelog entry to make this migration re-runnable
  // This allows the migration to run on every deployment for recurring data resets
  await db
    .collection("changelog")
    .deleteOne({ fileName: "99999999999999-perf-test-seed.js" });
  console.log(
    "♻️  Removed previous run from changelog (making migration re-runnable)",
  );

  console.log("🧹 Starting performance test data seeding...");
  console.log("⚠️  This will CLEAR ALL DATA in the following collections:");
  console.log("   - cases");
  console.log("   - users (test users only, keeps service accounts)");
  console.log("   - workflows");
  console.log("   - outbox");
  console.log("   - inbox");

  // Step 1: Clear existing data
  console.log("\n🗑️  Clearing collections...");

  await db.collection("cases").deleteMany({});
  console.log("   ✓ Cleared cases");

  await db.collection("users").deleteMany({ _id: /^perf-test-user-/ });
  console.log("   ✓ Cleared test users (kept service accounts)");

  await db.collection("workflows").deleteMany({});
  console.log("   ✓ Cleared workflows");

  await db.collection("outbox").deleteMany({});
  console.log("   ✓ Cleared outbox");

  await db.collection("inbox").deleteMany({});
  console.log("   ✓ Cleared inbox");

  // Step 2: Seed performance test data
  console.log("\n📝 Seeding test data...");

  // Test users for performance testing
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

  // Test cases matching GAS applications
  const testCases = [];

  // Generate 100 test cases matching the GAS applications
  for (let i = 0; i < 100; i++) {
    const clientRef = `perf-test-${String(i).padStart(3, "0")}`;
    const caseId = `case-${clientRef}`;

    testCases.push({
      _id: caseId,
      caseRef: clientRef, // Matches GAS application clientRef
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

  if (testUsers.length > 0) {
    await db.collection("users").insertMany(testUsers);
    console.log(`   ✓ Inserted ${testUsers.length} test users`);
  }

  if (testCases.length > 0) {
    await db.collection("cases").insertMany(testCases);
    console.log(`   ✓ Inserted ${testCases.length} test cases`);
  }

  console.log("\n✅ Performance test data seeding complete!");
  console.log(`   Total cases: ${testCases.length}`);
  console.log(
    `   Case refs: perf-test-000 to perf-test-${String(testCases.length - 1).padStart(3, "0")}`,
  );
  console.log(`   Test users: ${testUsers.length}`);
};

export const down = async (db) => {
  // Rollback: Remove all perf test data
  console.log("🔄 Rolling back performance test data...");

  await db.collection("cases").deleteMany({ caseRef: /^perf-test-/ });
  await db.collection("users").deleteMany({ _id: /^perf-test-user-/ });

  console.log("✅ Rollback complete");
};
