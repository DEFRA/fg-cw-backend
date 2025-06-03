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
import Wreck from "@hapi/wreck";
import { caseData1, caseData2, caseData3 } from "./fixtures/case.js";
import createCaseEvent3 from "./fixtures/create-case-event-3.json";
import { collection as caseCollection } from "../src/repository/case.repository.js";
import { purgeSqsQueue, sendSnsMessage } from "./helpers/sns-utils.js";
import { config } from "../src/common/config.js";

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
      await cases.deleteMany({});
    });

    afterEach(async () => {
      await cases.deleteMany({});
    });

    it.sequential("adds a case", async () => {
      const response = await Wreck.post(`${env.API_URL}/case-events`, {
        json: true,
        payload: createCaseEvent3.data
      });

      expect(response.res.statusCode).toBe(201);
      expect(response.payload).toEqual({
        ...caseData3,
        _id: expect.any(String),
        dateReceived: expect.any(String),
        currentStage: "application-receipt",
        stages: [
          {
            id: "application-receipt",
            taskGroups: [
              {
                id: "application-receipt-tasks",
                tasks: [
                  {
                    id: "simple-review",
                    isComplete: false
                  }
                ]
              }
            ]
          },
          {
            id: "contract",
            taskGroups: []
          }
        ]
      });

      const documents = await cases.find({}).toArray();

      expect(documents.length).toBe(1);
      expect(documents[0]).toEqual({
        ...caseData3,
        dateReceived: expect.any(String),
        _id: expect.any(Object),
        payload: {
          ...caseData3.payload,
          createdAt: new Date(caseData3.payload.createdAt),
          submittedAt: new Date(caseData3.payload.submittedAt)
        },
        currentStage: "application-receipt",
        stages: [
          {
            id: "application-receipt",
            taskGroups: [
              {
                id: "application-receipt-tasks",
                tasks: [
                  {
                    id: "simple-review",
                    isComplete: false
                  }
                ]
              }
            ]
          },
          {
            id: "contract",
            taskGroups: []
          }
        ]
      });
    });
  });

  describe.sequential("POST /cases", () => {
    beforeEach(async () => {
      await cases.deleteMany({});
    });

    afterEach(async () => {
      await cases.deleteMany({});
    });

    it.sequential("adds a case", async () => {
      const response = await Wreck.post(`${env.API_URL}/cases`, {
        json: true,
        payload: caseData1
      });

      expect(response.res.statusCode).toBe(201);
      expect(response.payload).toEqual({
        ...caseData1,
        _id: expect.any(String)
      });

      const documents = await cases.find({}).toArray();

      expect(documents.length).toBe(1);
      expect(documents[0]).toEqual({
        ...caseData1,
        dateReceived: new Date(caseData1.dateReceived),
        targetDate: new Date(caseData1.targetDate),
        _id: expect.any(Object),
        payload: {
          ...caseData1.payload,
          createdAt: new Date(caseData1.payload.createdAt),
          submittedAt: new Date(caseData1.payload.submittedAt)
        }
      });
    });
  });

  describe.sequential("GET /cases", () => {
    beforeEach(async () => {
      await cases.deleteMany({});
    });

    afterEach(async () => {
      await cases.deleteMany({});
    });

    it.sequential("finds cases", async () => {
      await cases.insertMany([{ ...caseData1 }, { ...caseData2 }]);

      const response = await Wreck.get(`${env.API_URL}/cases`, {
        json: true
      });

      expect(response.res.statusCode).toBe(200);
      expect(response.payload.metadata.page).toEqual(1);
      expect(response.payload.metadata.pageSize).toEqual(100);
      expect(response.payload.metadata.count).toEqual(2);
      expect(response.payload.metadata.pageCount).toEqual(1);
      expect(response.payload.status).toEqual("success");
      expect(response.payload.data.length).toBe(2);
      expect(response.payload.data[0]).toEqual({
        ...caseData1,
        _id: expect.any(String)
      });
      expect(response.payload.data[1]).toEqual({
        ...caseData2,
        _id: expect.any(String)
      });
    });
  });

  describe.sequential("GET /cases/{caseId}", () => {
    beforeEach(async () => {
      await cases.deleteMany({});
    });

    it.sequential("finds a case by code", async () => {
      const { insertedIds } = await cases.insertMany([
        { ...caseData1 },
        { ...caseData2 }
      ]);

      const response = await Wreck.get(
        `${env.API_URL}/cases/${insertedIds[1]}`,
        {
          json: true
        }
      );

      expect(response.res.statusCode).toBe(200);
      expect(response.payload).toEqual({
        ...caseData2,
        _id: expect.any(String)
      });
    });
  });

  describe.sequential("SNS case-event", () => {
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
      expect(documents).toHaveLength(1);
      expect(documents[0]).toEqual({
        ...caseData3,
        dateReceived: expect.any(String),
        _id: expect.any(Object),
        payload: {
          ...caseData3.payload,
          createdAt: caseData3.payload.createdAt,
          submittedAt: caseData3.payload.submittedAt
        }
      });
    });
  });
});
