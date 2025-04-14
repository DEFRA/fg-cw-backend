import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { env } from "node:process";
import { MongoClient } from "mongodb";
import Wreck from "@hapi/wreck";
import { caseData1, caseData2 } from "./fixtures/case.js";
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

  describe.sequential("POST /cases", () => {
    beforeEach(async () => {
      await cases.deleteMany({});
    });

    it("adds a case", async () => {
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
        _id: expect.any(Object)
      });
    });
  });

  describe.sequential("GET /cases", () => {
    beforeEach(async () => {
      await cases.deleteMany({});
    });

    it("finds cases", async () => {
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

    it("finds a case by code", async () => {
      await cases.insertMany([{ ...caseData1 }, { ...caseData2 }]);

      const response = await Wreck.get(`${env.API_URL}/cases/100002`, {
        json: true
      });

      expect(response.res.statusCode).toBe(200);
      expect(response.payload).toEqual({
        ...caseData2,
        _id: expect.any(String)
      });
    });
  });
});
