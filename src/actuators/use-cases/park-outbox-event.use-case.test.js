import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  findStatusById,
  parkById,
} from "../../cases/repositories/outbox.repository.js";
import { parkOutboxEventUseCase } from "./park-outbox-event.use-case.js";

vi.mock("../../cases/repositories/outbox.repository.js");

const ID = "665f1c2e9a1b2c3d4e5f6a7b";

const aRow = (overrides = {}) => ({
  _id: ID,
  status: "PARKED",
  parked: { at: "2026-06-16T11:00:00.000Z", reason: "poison", by: "donatas" },
  ...overrides,
});

beforeEach(() => {
  parkById.mockReset();
  findStatusById.mockReset();
});

describe("parkOutboxEventUseCase", () => {
  it("issues the conditional update with the reason and the actor", async () => {
    parkById.mockResolvedValue(aRow());

    await parkOutboxEventUseCase(ID, { reason: "poison", by: "donatas" });

    expect(parkById).toHaveBeenCalledWith(ID, {
      reason: "poison",
      by: "donatas",
    });
  });

  it("answers with the parked row and its retry cap", async () => {
    parkById.mockResolvedValue(aRow());

    const row = await parkOutboxEventUseCase(ID, { reason: "poison" });

    expect(row.status).toBe("PARKED");
    expect(row.parked.reason).toBe("poison");
    expect(row.maxAttempts).toBeGreaterThan(0);
  });

  it("is a 404 when there is no such row", async () => {
    parkById.mockResolvedValue(null);
    findStatusById.mockResolvedValue(null);

    await expect(
      parkOutboxEventUseCase(ID, { reason: "poison" }),
    ).rejects.toMatchObject({ output: { statusCode: 404 } });
  });

  it("is a 409 naming the status that blocked it", async () => {
    parkById.mockResolvedValue(null);
    findStatusById.mockResolvedValue("COMPLETED");

    await expect(
      parkOutboxEventUseCase(ID, { reason: "poison" }),
    ).rejects.toMatchObject({
      output: { statusCode: 409, payload: { status: "COMPLETED" } },
    });
  });

  it("only reads the status on the failure path", async () => {
    parkById.mockResolvedValue(aRow());

    await parkOutboxEventUseCase(ID, { reason: "poison" });

    expect(findStatusById).not.toHaveBeenCalled();
  });
});
