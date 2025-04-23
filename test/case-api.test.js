import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { env } from "node:process";
import { MongoClient } from "mongodb";
import Wreck from "@hapi/wreck";
import { caseData1, caseData2, caseData3 } from "./fixtures/case.js";
import createCaseEvent3 from "./fixtures/create-case-event-3.json";
import { collection as caseCollection } from "../src/repository/case.repository.js";

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

    it.sequential("adds a case", async () => {
      const response = await Wreck.post(`${env.API_URL}/case-events`, {
        json: true,
        payload: createCaseEvent3
      });

      expect(response.res.statusCode).toBe(201);
      expect(response.payload).toEqual({
        ...caseData3,
        _id: expect.any(String),
        dateReceived: expect.any(String)
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
        }
      });
    });
  });

  describe.sequential("POST /cases", () => {
    beforeEach(async () => {
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
});
