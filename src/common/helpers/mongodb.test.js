import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { Db, MongoClient } from "mongodb";
import { LockManager } from "mongo-locks";

import { createServer } from "../../server.js";

describe.skip("#mongoDb", () => {
  let server;

  describe("Set up", () => {
    beforeAll(async () => {
      server = await createServer();
      await server.initialize();
    });

    afterAll(async () => {
      await server.stop({ timeout: 0 });
    });

    test("Server should have expected MongoDb decorators", () => {
      expect(server.db).toBeInstanceOf(Db);
      expect(server.mongoClient).toBeInstanceOf(MongoClient);
      expect(server.locker).toBeInstanceOf(LockManager);
    });

    test("MongoDb should have expected database name", () => {
      expect(server.db.databaseName).toBe("fg-cw-backend");
    });

    test("MongoDb should have expected namespace", () => {
      expect(server.db.namespace).toBe("fg-cw-backend");
    });
  });

  describe("Shut down", () => {
    beforeAll(async () => {
      server = await createServer();
      await server.initialize();
    });

    test("Should close Mongo client on server stop", async () => {
      const closeSpy = vi.spyOn(server.mongoClient, "close");
      await server.stop({ timeout: 0 });

      expect(closeSpy).toHaveBeenCalledWith(true);
    });
  });
});
