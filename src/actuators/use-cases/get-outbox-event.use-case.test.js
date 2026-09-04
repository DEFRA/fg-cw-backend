import { describe, expect, it, vi } from "vitest";
import { findDetailById } from "../../cases/repositories/outbox.repository.js";
import { getOutboxEventUseCase } from "./get-outbox-event.use-case.js";

vi.mock("../../common/mongo-client.js");
vi.mock("../../cases/repositories/outbox.repository.js");

const ID = "665f1c2e9a1b2c3d4e5f6a7b";

const aDetail = () => ({
  _id: ID,
  status: "DEAD_LETTER",
  completionAttempts: 5,
  maxAttempts: 5,
  event: { id: "evt-1", data: { clientRef: "REF-1" } },
});

describe("getOutboxEventUseCase", () => {
  it("reads the row by id", async () => {
    findDetailById.mockResolvedValue(aDetail());

    await getOutboxEventUseCase(ID);

    expect(findDetailById).toHaveBeenCalledWith(ID);
  });

  it("returns the detail document untouched", async () => {
    const detail = aDetail();
    findDetailById.mockResolvedValue(detail);

    expect(await getOutboxEventUseCase(ID)).toBe(detail);
  });

  it("returns the full event payload", async () => {
    findDetailById.mockResolvedValue(aDetail());

    const result = await getOutboxEventUseCase(ID);

    expect(result.event).toEqual({ id: "evt-1", data: { clientRef: "REF-1" } });
  });

  it("404s when there is no such row", async () => {
    findDetailById.mockResolvedValue(null);

    await expect(getOutboxEventUseCase(ID)).rejects.toMatchObject({
      output: { statusCode: 404 },
    });
  });

  it("names the id in the 404", async () => {
    findDetailById.mockResolvedValue(null);

    await expect(getOutboxEventUseCase(ID)).rejects.toThrow(ID);
  });
});
