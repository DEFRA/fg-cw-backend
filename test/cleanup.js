import { MongoClient } from "mongodb";
import { env } from "node:process";
import { afterEach, beforeEach } from "vitest";
import { purgeQueue } from "./helpers/sqs.js";

let client;

beforeEach(async () => {
  client = await MongoClient.connect(env.MONGO_URI);
  const db = client.db();

  await Promise.all([
    db.collection("cases").deleteMany({}),
    db.collection("workflows").deleteMany({}),
    db.collection("users").deleteMany({}),
    db.collection("roles").deleteMany({}),
  ]);

  await purgeQueue(env.CW__SQS__CREATE_NEW_CASE_URL);
});

afterEach(async () => {
  await client?.close();
});
