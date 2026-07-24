import { MongoClient } from "mongodb";

const uri =
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/?directConnection=true";
const dbName = process.env.MONGO_DATABASE || "fg-cw-backend";

const WORKFLOW_CODE = "frps-private-beta";
const CORRECT_URL = "http://localhost:3100/agreement/{agreementRef}";

async function fixAgreementsUrl() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(dbName);

    const result = await db.collection("workflows").updateOne(
      { code: WORKFLOW_CODE },
      {
        $set: {
          "definitions.agreementsService.internalUrl": CORRECT_URL,
        },
      },
    );

    if (result.matchedCount === 0) {
      console.error(`Workflow not found: ${WORKFLOW_CODE}`);
      process.exit(1);
    }

    console.log(`Updated agreements internalUrl to ${CORRECT_URL}`);
  } finally {
    await client.close();
  }
}

fixAgreementsUrl().catch((err) => {
  console.error(err);
  process.exit(1);
});
