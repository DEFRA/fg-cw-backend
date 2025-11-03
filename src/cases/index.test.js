import hapi from "@hapi/hapi";
import { up } from "migrate-mongo";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { logger } from "../common/logger.js";
import { db, mongoClient } from "../common/mongo-client.js";
import { cases } from "./index.js";
import { createNewCaseSubscriber } from "./subscribers/create-new-case.subscriber.js";
import { OutboxSubscriber } from "./subscribers/outbox.subscriber.js";
import { createUpdateStatusAgreementConsumer } from "./subscribers/update-case-status-agreement.subscriber.js";

vi.mock("migrate-mongo");
vi.mock("../common/logger.js", () => ({
  logger: {
    info: vi.fn(),
  },
}));
vi.mock("../common/mongo-client.js");
vi.mock("./subscribers/create-new-case.subscriber.js");
vi.mock("./subscribers/update-case-status-agreement.subscriber.js");

describe("cases", () => {
  let server;

  beforeEach(() => {
    server = hapi.server();
    up.mockResolvedValue([]);
  });

  it("runs migrations on startup", async () => {
    await server.register(cases);
    await server.initialize();

    expect(up).toHaveBeenCalledWith(db, mongoClient);
  });

  it("logs applied migrations", async () => {
    up.mockResolvedValue(["001-initial-migration.js", "002-add-some-data.js"]);

    await server.register(cases);
    await server.initialize();

    expect(logger.info).toHaveBeenCalledWith("Running migrations");
    expect(logger.info).toHaveBeenCalledWith(
      "Migrated: 001-initial-migration.js",
    );
    expect(logger.info).toHaveBeenCalledWith("Migrated: 002-add-some-data.js");
    expect(logger.info).toHaveBeenCalledWith("Finished running migrations");
  });

  it("starts subscribers on startup", async () => {
    const outboxStart = vi.fn();
    OutboxSubscriber.prototype.start = outboxStart;

    await server.register(cases);
    await server.initialize();

    server.events.emit("start");

    expect(createNewCaseSubscriber.start).toHaveBeenCalled();
    expect(createUpdateStatusAgreementConsumer.start).toHaveBeenCalled();
    expect(outboxStart).toHaveBeenCalled();
  });

  it("stops subscribers on shutdown", async () => {
    const outboxStop = vi.fn();
    OutboxSubscriber.prototype.stop = outboxStop;
    await server.register(cases);
    await server.initialize();

    server.events.emit("stop");

    expect(createNewCaseSubscriber.stop).toHaveBeenCalled();
    expect(createUpdateStatusAgreementConsumer.stop).toHaveBeenCalled();
    expect(outboxStop).toHaveBeenCalled();
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
      {
        method: "get",
        path: "/cases/{caseId}/tabs/{tabId}",
      },
      { method: "patch", path: "/cases/{caseId}/assigned-user" },
      {
        method: "patch",
        path: "/cases/{caseId}/stage/outcome",
      },
      {
        method: "patch",
        path: "/cases/{caseId}/phases/{phaseCode}/stages/{stageCode}/task-groups/{taskGroupCode}/tasks/{taskCode}/status",
      },
      { method: "post", path: "/workflows" },
      { method: "post", path: "/cases/{caseId}/notes" },
    ]);
  });
});
