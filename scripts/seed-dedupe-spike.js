// Deliberately opt-in: seed the real application using a fresh local database.
import { up } from "migrate-mongo";
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
  // The initial application migration drops/recreates collections. Apply all
  // migrations before seeding so normal startup cannot erase the demo data.
  await up(db, mongoClient);
  const { user } = await seedDedupe();
  process.stdout.write(
    `Seeded ${db.databaseName}. Owner: ${user.name}. Start both branches and open /cases.\n`,
  );
} finally {
  await mongoClient.close();
}
