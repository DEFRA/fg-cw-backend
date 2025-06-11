import Wreck from "@hapi/wreck";
import { MongoClient } from "mongodb";
import { env } from "node:process";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { workflowData1, workflowData2 } from "./fixtures/workflow.js";

describe("Workflows", () => {
  let workflows;
  let client;

  beforeAll(async () => {
    client = new MongoClient(env.MONGO_URI);
    await client.connect();
    workflows = client.db().collection("workflows");
  });

  afterAll(async () => {
    await client.close(true);
  });

  describe("POST /workflows", () => {
    beforeEach(async () => {
      await workflows.deleteMany({});
    });

    it("adds a workflow", async () => {
      const payload = { ...workflowData1 };
      const response = await Wreck.post(`${env.API_URL}/workflows`, {
        json: true,
        payload,
      });

      expect(response.res.statusCode).toEqual(204);

      const documents = await workflows.find({}).toArray();

      expect(documents.length).toBe(1);
      expect(documents[0]).toEqual({
        ...payload,
        _id: expect.any(Object),
      });
    });

    it("throws when workflow code exists", async () => {
      const payload = { ...workflowData1 };
      await Wreck.post(`${env.API_URL}/workflows`, {
        json: true,
        payload,
      });

      await expect(
        Wreck.post(`${env.API_URL}/workflows`, {
          json: true,
          payload,
        }),
      ).rejects.toThrow("Response Error: 409 Conflict");
    });
  });

  describe("GET /workflows", () => {
    beforeEach(async () => {
      await workflows.deleteMany({});
    });

    it("finds workflows", async () => {
      await workflows.insertMany([{ ...workflowData1 }, { ...workflowData2 }]);

      const response = await Wreck.get(`${env.API_URL}/workflows`, {
        json: true,
      });

      expect(response.res.statusCode).toBe(200);
      expect(response.payload).toEqual([
        {
          ...workflowData1,
          _id: expect.any(String),
        },
        {
          ...workflowData2,
          _id: expect.any(String),
        },
      ]);
    });
  });

  describe("GET /workflows/{code}", () => {
    beforeEach(async () => {
      await workflows.deleteMany({});
    });

    it("finds a workflow by code", async () => {
      await workflows.insertMany([{ ...workflowData1 }, { ...workflowData2 }]);

      const response = await Wreck.get(
        `${env.API_URL}/workflows/frps-private-beta`,
        {
          json: true,
        },
      );

      expect(response.res.statusCode).toBe(200);

      expect(response.payload).toEqual({
        ...workflowData1,
        _id: expect.any(String),
      });
    });
  });
});
