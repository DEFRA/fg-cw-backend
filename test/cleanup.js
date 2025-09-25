import { MongoClient } from "mongodb";
import { env } from "node:process";
import { afterEach, beforeEach } from "vitest";
import { purgeQueue } from "./helpers/sqs.js";

let client;

beforeEach(async () => {
  client = await MongoClient.connect(env.MONGO_URI);
  const db = client.db();

  db.collection("cases").deleteMany({});
  db.collection("workflows").deleteMany({});

  await purgeQueue(env.CW__SQS__CREATE_NEW_CASE_URL);
});

afterEach(async () => {
  await client?.close();
});
