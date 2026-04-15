import fs from "fs";
import { MongoClient } from "mongodb";
import path from "path";

const uri = process.env.MONGO_URI || "mongodb://localhost:27017";
const dbName = "fg-cw-backend";

async function exportPerfTestCases() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(dbName);

    console.log("Fetching all perf test cases...");

    // Get all cases, sorted by caseRef
    const cases = await db
      .collection("cases")
      .find({}, { _id: 1, caseRef: 1 })
      .sort({ caseRef: 1 })
      .toArray();

    console.log(`Found ${cases.length} cases`);

    if (cases.length === 0) {
      console.log("No cases found");
      return;
    }

    // Create CSV content
    const csvHeader = "caseRef,caseId\n";
    const csvRows = cases
      .map((c) => `${c.caseRef},${c._id.toString()}`)
      .join("\n");
    const csvContent = csvHeader + csvRows;

    // Define output path
    const outputPath = path.join(
      process.env.OUTPUT_PATH ||
        "/Users/nitinmali/workspace/farming/future-grants-perf-tests/data",
      "perf_test_case_refs_frps.csv",
    );

    // Ensure directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Write CSV file
    fs.writeFileSync(outputPath, csvContent, "utf8");

    console.log(`✅ Exported ${cases.length} cases to ${outputPath}`);
    console.log(`   First case: ${cases[0].caseRef} (${cases[0]._id})`);
    console.log(
      `   Last case: ${cases[cases.length - 1].caseRef} (${cases[cases.length - 1]._id})`,
    );
  } catch (error) {
    console.error("Error:", error);
    throw error;
  } finally {
    await client.close();
  }
}

exportPerfTestCases().catch(console.error);
