import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  findStatusById,
  unparkById,
} from "../../cases/repositories/outbox.repository.js";
import { unparkOutboxEventUseCase } from "./unpark-outbox-event.use-case.js";

vi.mock("../../cases/repositories/outbox.repository.js");

const ID = "665f1c2e9a1b2c3d4e5f6a7b";

beforeEach(() => {
  unparkById.mockReset();
  findStatusById.mockReset();
});

describe("unparkOutboxEventUseCase", () => {
  it("issues the conditional update by id", async () => {
    unparkById.mockResolvedValue({ _id: ID, status: "DEAD_LETTER" });

    await unparkOutboxEventUseCase(ID);

    expect(unparkById).toHaveBeenCalledWith(ID);
  });

  it("answers with the row back in DEAD_LETTER", async () => {
    unparkById.mockResolvedValue({
      _id: ID,
      status: "DEAD_LETTER",
      parked: null,
    });

    const row = await unparkOutboxEventUseCase(ID);

    expect(row.status).toBe("DEAD_LETTER");
    expect(row.parked).toBeNull();
  });

  it("is a 404 when there is no such row", async () => {
    unparkById.mockResolvedValue(null);
    findStatusById.mockResolvedValue(null);

    await expect(unparkOutboxEventUseCase(ID)).rejects.toMatchObject({
      output: { statusCode: 404 },
    });
  });

  it("is a 409 saying the row is not PARKED", async () => {
    unparkById.mockResolvedValue(null);
    findStatusById.mockResolvedValue("DEAD_LETTER");

    await expect(unparkOutboxEventUseCase(ID)).rejects.toMatchObject({
      output: { statusCode: 409, payload: { status: "DEAD_LETTER" } },
    });
  });
});
