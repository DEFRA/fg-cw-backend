import { MongoClient, ObjectId } from "mongodb";
import { env } from "node:process";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { caseData1, caseData2, caseData3 } from "./fixtures/case.js";
import createCaseEvent3 from "./fixtures/create-case-event-3.json";
import { purgeSqsQueue, sendSnsMessage } from "./helpers/sns-utils.js";
import { waitForDocuments } from "./helpers/wait-for-documents.js";
import { wreck } from "./helpers/wreck.js";

describe("Cases", () => {
  let cases;
  let client;

  beforeAll(async () => {
    client = new MongoClient(env.MONGO_URI);
    await client.connect();
    cases = client.db().collection("cases");
  });

  afterAll(async () => {
    await client.close(true);
  });

  describe("GET /cases", () => {
    beforeEach(async () => {
      await cases.deleteMany({});
    });

    afterEach(async () => {
      await cases.deleteMany({});
    });

    it("finds cases", async () => {
      await cases.insertMany([
        {
          ...caseData1,
          dateReceived: new Date(caseData1.dateReceived),
        },
        {
          ...caseData2,
          dateReceived: new Date(caseData2.dateReceived),
        },
      ]);

      const response = await wreck.get("/cases");

      expect(response.res.statusCode).toBe(200);

      expect(response.payload).toEqual([
        {
          ...caseData1,
          _id: expect.any(String),
          dateReceived: new Date(caseData1.dateReceived).toISOString(),
        },
        {
          ...caseData2,
          _id: expect.any(String),
          dateReceived: new Date(caseData2.dateReceived).toISOString(),
        },
      ]);
    });
  });

  describe("GET /cases/{caseId}", () => {
    beforeEach(async () => {
      await cases.deleteMany({});
    });

    it("finds a case by id", async () => {
      const { insertedIds } = await cases.insertMany([
        {
          ...caseData1,
          dateReceived: new Date(caseData1.dateReceived),
        },
        {
          ...caseData2,
          dateReceived: new Date(caseData2.dateReceived),
        },
      ]);

      const caseId = insertedIds[1].toHexString();

      const response = await wreck.get(`/cases/${caseId}`);

      expect(response.res.statusCode).toBe(200);
      expect(response.payload).toEqual({
        ...caseData2,
        _id: caseId,
        dateReceived: new Date(caseData2.dateReceived).toISOString(),
      });
    });
  });

  describe("on CreateNewCase", () => {
    beforeEach(async () => {
      await purgeSqsQueue(env.CREATE_NEW_CASE_SQS_URL);
      await cases.deleteMany({});
    });

    afterEach(async () => {
      await purgeSqsQueue(env.CREATE_NEW_CASE_SQS_URL);
      await cases.deleteMany({});
    });

    it("creates a new case", async () => {
      await sendSnsMessage(
        "arn:aws:sns:eu-west-2:000000000000:grant_application_created",
        createCaseEvent3,
      );

      const documents = await waitForDocuments(cases);

      expect(documents).toEqual([
        {
          ...caseData3,
          _id: expect.any(ObjectId),
          dateReceived: expect.any(Date),
        },
      ]);
    });
  });
});
