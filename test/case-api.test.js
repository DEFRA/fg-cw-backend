import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DockerComposeEnvironment, Wait } from "testcontainers";
import { MongoClient } from "mongodb";
import Wreck from "@hapi/wreck";
import { caseData1, caseData2 } from "./fixtures/case.js";
import { collection as caseCollection } from "../src/repository/case.repository.js";

describe.sequential("Case API", () => {
  const CW_PORT = 3801;
  const MONGO_PORT = 28017;
  const AWS_PORT = 4866;
  const REDIS_PORT = 6879;
  const MONGO_URI = `mongodb://localhost:${MONGO_PORT}/fg-cw-backend`;
  const API_URL = `http://localhost:${CW_PORT}`;

  let environment;
  let cases;
  let client;

  beforeAll(async () => {
    environment = await new DockerComposeEnvironment(".", "compose.yml")
      .withEnvironment({
        CW_PORT,
        MONGO_PORT,
        AWS_PORT,
        REDIS_PORT
      })
      .withWaitStrategy("redis", Wait.forListeningPorts())
      .withWaitStrategy("mongodb", Wait.forListeningPorts())
      .withWaitStrategy("localstack", Wait.forHealthCheck())
      .withWaitStrategy("fg-cw-backend", Wait.forListeningPorts())
      .withNoRecreate()
      .up();

    // Connect to MongoDB
    client = new MongoClient(MONGO_URI);
    await client.connect();
    cases = client.db().collection(caseCollection);
  });

  afterAll(async () => {
    await client.close();
    if (environment) {
      await environment.down();
    }
  });

  describe.sequential("POST /cases", () => {
    beforeEach(async () => {
      await cases.deleteMany({});
    });

    it("adds a case", async () => {
      const response = await Wreck.post(`${API_URL}/cases`, {
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

      const response = await Wreck.get(`${API_URL}/cases`, {
        json: true
      });

      expect(response.res.statusCode).toBe(200);
      expect(response.payload.length).toBe(2);
      expect(response.payload[0]).toEqual({
        ...caseData1,
        _id: expect.any(String)
      });
      expect(response.payload[1]).toEqual({
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

      const response = await Wreck.get(`${API_URL}/cases/100002`, {
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
