// Deliberately opt-in: seed the real application using a fresh local database.
import { db, mongoClient } from "../src/common/mongo-client.js";
import { seedDedupe } from "../test/helpers/dedupe-seed.js";

if (!db.databaseName.startsWith("fgp1594-spike"))
  throw new Error(
    "Use MONGO_DATABASE=fgp1594-spike with a local scratch replica set",
  );
try {
  if ((await db.listCollections().toArray()).length)
    throw new Error(
      "Use an empty database; the seed will not overwrite existing data",
    );
  const { user } = await seedDedupe();
  process.stdout.write(
    `Seeded ${db.databaseName}. Owner: ${user.name}. Start both branches and open /cases.\n`,
  );
} finally {
  await mongoClient.close();
}
