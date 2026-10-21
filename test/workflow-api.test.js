import { MongoClient } from "mongodb";
import { env } from "node:process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { workflowData1, workflowData2 } from "./fixtures/workflow.js";
import { wreck } from "./helpers/wreck.js";

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

  describe("GET /workflows", () => {
    it("finds workflows", async () => {
      await workflows.insertMany([{ ...workflowData1 }, { ...workflowData2 }]);

      const response = await wreck.get("/workflows");

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
    it("finds a workflow by code", async () => {
      await workflows.insertMany([{ ...workflowData1 }, { ...workflowData2 }]);

      const response = await wreck.get("/workflows/frps-private-beta");

      expect(response.res.statusCode).toBe(200);

      expect(response.payload).toEqual({
        ...workflowData1,
        _id: expect.any(String),
      });
    });
  });
});
