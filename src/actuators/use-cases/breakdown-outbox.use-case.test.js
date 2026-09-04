import { beforeEach, describe, expect, it, vi } from "vitest";
import { breakdown } from "../../cases/repositories/outbox.repository.js";
import { breakdownOutboxUseCase } from "./breakdown-outbox.use-case.js";

vi.mock("../../cases/repositories/outbox.repository.js");

beforeEach(() => {
  breakdown.mockReset();
  breakdown.mockResolvedValue([]);
});

describe("breakdownOutboxUseCase", () => {
  it("passes exactly the counts filter through", async () => {
    await breakdownOutboxUseCase({
      q: "GLD-9B2",
      error: "boom",
      from: "2026-06-16T00:00:00.000Z",
      to: "2026-06-16T23:59:59.999Z",
    });

    expect(breakdown).toHaveBeenCalledWith({
      q: "GLD-9B2",
      error: "boom",
      from: "2026-06-16T00:00:00.000Z",
      to: "2026-06-16T23:59:59.999Z",
    });
  });

  it("never passes a status - the scope is pinned to DEAD_LETTER in the repository", async () => {
    await breakdownOutboxUseCase({});

    expect(breakdown.mock.calls[0][0]).not.toHaveProperty("status");
    // The TYPE filter is gone: nothing about kind reaches the repository.
    expect(breakdown.mock.calls[0][0]).not.toHaveProperty("kind");
  });

  it("answers with the groups under `groups`", async () => {
    breakdown.mockResolvedValue([
      { error: "boom", type: "t", count: 3, firstAt: null, lastAt: null },
    ]);

    expect(await breakdownOutboxUseCase({})).toEqual({
      groups: [
        { error: "boom", type: "t", count: 3, firstAt: null, lastAt: null },
      ],
    });
  });
});
