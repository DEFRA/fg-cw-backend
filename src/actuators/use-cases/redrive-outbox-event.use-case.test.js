import { describe, expect, it, vi } from "vitest";
import {
  findStatusById,
  redriveById,
} from "../../cases/repositories/outbox.repository.js";
import { redriveOutboxEventUseCase } from "./redrive-outbox-event.use-case.js";

vi.mock("../../common/mongo-client.js");
vi.mock("../../cases/repositories/outbox.repository.js");

const ID = "665f1c2e9a1b2c3d4e5f6a7b";

const aRow = () => ({
  _id: ID,
  eventId: "evt-1",
  status: "RESUBMITTED",
  completionAttempts: 0,
});

describe("redriveOutboxEventUseCase", () => {
  it("issues the conditional update by id", async () => {
    redriveById.mockResolvedValue(aRow());

    await redriveOutboxEventUseCase(ID);

    expect(redriveById).toHaveBeenCalledWith(ID, { by: undefined });
  });

  it("returns the updated list row", async () => {
    redriveById.mockResolvedValue(aRow());

    expect(await redriveOutboxEventUseCase(ID)).toMatchObject({
      _id: ID,
      status: "RESUBMITTED",
      completionAttempts: 0,
    });
  });

  it("stamps maxAttempts on the returned row", async () => {
    redriveById.mockResolvedValue(aRow());

    expect((await redriveOutboxEventUseCase(ID)).maxAttempts).toBe(5);
  });

  it("does not read the status again on the happy path", async () => {
    redriveById.mockResolvedValue(aRow());

    await redriveOutboxEventUseCase(ID);

    expect(findStatusById).not.toHaveBeenCalled();
  });

  it("404s when the conditional update matched nothing and the row is gone", async () => {
    redriveById.mockResolvedValue(null);
    findStatusById.mockResolvedValue(null);

    await expect(redriveOutboxEventUseCase(ID)).rejects.toMatchObject({
      output: { statusCode: 404 },
    });
  });

  it("409s when the row is no longer DEAD_LETTER", async () => {
    redriveById.mockResolvedValue(null);
    findStatusById.mockResolvedValue("COMPLETED");

    await expect(redriveOutboxEventUseCase(ID)).rejects.toMatchObject({
      output: { statusCode: 409 },
    });
  });

  it("puts the current status in the 409 body", async () => {
    redriveById.mockResolvedValue(null);
    findStatusById.mockResolvedValue("PUBLISHED");

    await expect(redriveOutboxEventUseCase(ID)).rejects.toMatchObject({
      output: { payload: { statusCode: 409, status: "PUBLISHED" } },
    });
  });

  // the race: the row was DEAD_LETTER when the page rendered, but something
  // else moved it before the update landed. The update matches nothing, so
  // nothing is clobbered and the caller is told what it is now.
  it("loses cleanly to a concurrent state change", async () => {
    redriveById.mockResolvedValue(null);
    findStatusById.mockResolvedValue("PROCESSING");

    await expect(redriveOutboxEventUseCase(ID)).rejects.toMatchObject({
      output: { payload: { status: "PROCESSING" } },
    });
    expect(redriveById).toHaveBeenCalledTimes(1);
  });
});

describe("redriveOutboxEventUseCase actor", () => {
  it("passes the actor through to the conditional update", async () => {
    redriveById.mockResolvedValue(aRow());

    await redriveOutboxEventUseCase(ID, { by: "donatas" });

    expect(redriveById).toHaveBeenCalledWith(ID, { by: "donatas" });
  });
});
