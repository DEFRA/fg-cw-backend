import hapi from "@hapi/hapi";
import { up } from "migrate-mongo";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db, mongoClient } from "../common/mongo-client.js";
import { cases } from "./index.js";
import { createNewCaseSubscriber } from "./subscribers/create-new-case.subscriber.js";

vi.mock("migrate-mongo");
vi.mock("../common/mongo-client.js");
vi.mock("./subscribers/create-new-case.subscriber.js");

describe("cases", () => {
  let server;

  beforeEach(() => {
    server = hapi.server();
  });

  it("runs migrations on startup", async () => {
    await server.register(cases);
    await server.initialize();

    expect(up).toHaveBeenCalledWith(db, mongoClient);
  });

  it("starts subscribers on startup", async () => {
    await server.register(cases);
    await server.initialize();

    server.events.emit("start");

    expect(createNewCaseSubscriber.start).toHaveBeenCalled();
  });

  it("stops subscribers on shutdown", async () => {
    await server.register(cases);
    await server.initialize();

    server.events.emit("stop");

    expect(createNewCaseSubscriber.stop).toHaveBeenCalled();
  });

  it("registers routes", async () => {
    await server.register(cases);
    await server.initialize();

    const routes = server.table().map((r) => ({
      path: r.path,
      method: r.method,
    }));

    expect(routes).toEqual([
      { method: "get", path: "/cases" },
      { method: "get", path: "/workflows" },
      { method: "get", path: "/cases/{caseId}" },
      { method: "get", path: "/workflows/{code}" },
      { method: "post", path: "/workflows" },
      { method: "post", path: "/cases/{caseId}/stage" },
      { method: "patch", path: "/cases/{caseId}/assigned-user" },
      {
        method: "patch",
        path: "/cases/{caseId}/stages/{stageId}/task-groups/{taskGroupId}/tasks/{taskId}/status",
      },
    ]);
  });
});
