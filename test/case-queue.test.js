import {
  afterAll,
  beforeAll,
  beforeEach,
  afterEach,
  describe,
  expect,
  it
} from "vitest";
import { env } from "node:process";
import { MongoClient } from "mongodb";
import { caseData3 } from "./fixtures/case.js";
import createCaseEvent3 from "./fixtures/create-case-event-3.json";
import { collection as caseCollection } from "../src/repository/case.repository.js";
import { purgeSqsQueue, sendSnsMessage } from "./helpers/sns-utils.js";
import { config } from "../src/config.js";

async function waitForCollectionChange(
  collection,
  maxRetries = 3,
  interval = 1000
) {
  let retryCount = 0;
  let numDocs = 0;
  let documents = [];
  while (retryCount < maxRetries && numDocs === 0) {
    documents = await collection.find({}).toArray();
    numDocs = documents.length;
    retryCount++;
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  return documents;
}

describe.sequential("Case API", () => {
  let cases;
  let client;

  beforeAll(async () => {
    client = new MongoClient(env.MONGO_URI);
    await client.connect();
    cases = client.db().collection(caseCollection);
  });

  afterAll(async () => {
    await client.close();
  });

  describe.sequential("POST /case-events", () => {
    beforeEach(async () => {
      try {
        await purgeSqsQueue(config.get("aws.createNewCaseSqsUrl"));
        await cases.deleteMany({});
      } catch (e) {
        console.log(e);
      }
    });

    afterEach(async () => {
      try {
        await purgeSqsQueue(config.get("aws.createNewCaseSqsUrl"));
        await cases.deleteMany({});
      } catch (e) {
        console.log(e);
      }
    });

    it.sequential("send case event to topic", async () => {
      await sendSnsMessage(
        "arn:aws:sns:eu-west-2:000000000000:grant_application_created",
        createCaseEvent3
      );
      const documents = await waitForCollectionChange(cases);
      expect(documents.length).toBe(1);
      expect(documents[0]).toEqual({
        ...caseData3,
        dateReceived: expect.any(String),
        _id: expect.any(Object),
        payload: {
          ...caseData3.payload,
          createdAt: new Date(caseData3.payload.createdAt),
          submittedAt: new Date(caseData3.payload.submittedAt)
        }
      });
    });
  });
});
