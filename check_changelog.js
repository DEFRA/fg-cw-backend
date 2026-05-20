import { MongoClient } from "mongodb";

const uri = process.env.MONGO_URI || "mongodb://localhost:27017";
const dbName = "fg-cw-backend";

const client = new MongoClient(uri);

async function checkChangelog() {
  try {
    await client.connect();
    const db = client.db(dbName);

    console.log("Checking changelog for frps-private-beta migrations...\n");

    const migrations = await db
      .collection("changelog")
      .find({ fileName: /frps/ })
      .sort({ appliedAt: 1 })
      .toArray();

    if (migrations.length === 0) {
      console.log("❌ No frps migrations found in changelog");
    } else {
      console.log(`✅ Found ${migrations.length} frps migrations:\n`);
      migrations.forEach((m) => {
        console.log(`- ${m.fileName} (applied: ${m.appliedAt})`);
      });
    }

    console.log("\n---\nKey migration to check:");
    const mainMigration = await db
      .collection("changelog")
      .findOne({ fileName: "20251114123000-add-frps-private-beta.js" });

    if (mainMigration) {
      console.log(
        "✅ 20251114123000-add-frps-private-beta.js HAS been applied",
      );
      console.log("   No need to delete from changelog");
    } else {
      console.log(
        "❌ 20251114123000-add-frps-private-beta.js NOT in changelog",
      );
      console.log("   Migration will run on next deployment");
    }
  } finally {
    await client.close();
  }
}

checkChangelog().catch(console.error);
