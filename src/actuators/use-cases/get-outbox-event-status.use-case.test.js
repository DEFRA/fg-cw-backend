import { describe, expect, it, vi } from "vitest";
import { findAttemptStatusById } from "../../cases/repositories/outbox.repository.js";
import { writeAuditEvent } from "../../common/write-audit-event.js";
import { getOutboxEventStatusUseCase } from "./get-outbox-event-status.use-case.js";

vi.mock("../../common/mongo-client.js");
vi.mock("../../common/write-audit-event.js");
vi.mock("../../cases/repositories/outbox.repository.js");

const ID = "665f1c2e9a1b2c3d4e5f6a7b";

describe("getOutboxEventStatusUseCase", () => {
  it("returns the status and the attempts against the cap", async () => {
    const status = {
      status: "RESUBMITTED",
      completionAttempts: 1,
      maxAttempts: 5,
    };
    findAttemptStatusById.mockResolvedValue(status);

    expect(await getOutboxEventStatusUseCase({ id: ID })).toEqual(status);
    expect(findAttemptStatusById).toHaveBeenCalledWith(ID);
  });

  it("writes no audit event", async () => {
    findAttemptStatusById.mockResolvedValue({
      status: "DEAD_LETTER",
      completionAttempts: 5,
      maxAttempts: 5,
    });

    await getOutboxEventStatusUseCase({ id: ID });

    expect(writeAuditEvent).not.toHaveBeenCalled();
  });

  it("404s for an unknown id", async () => {
    findAttemptStatusById.mockResolvedValue(null);

    await expect(getOutboxEventStatusUseCase({ id: ID })).rejects.toMatchObject(
      {
        output: { statusCode: 404 },
      },
    );
  });
});
