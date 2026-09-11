import { beforeEach, describe, expect, it, vi } from "vitest";
import { breakdown } from "../repositories/inbox.repository.js";
import { breakdownInboxUseCase } from "./breakdown-inbox.use-case.js";

vi.mock("../repositories/inbox.repository.js");

beforeEach(() => {
  breakdown.mockReset();
  breakdown.mockResolvedValue([]);
});

describe("breakdownInboxUseCase", () => {
  it("passes the counts filter through, minus the failure it groups by", async () => {
    await breakdownInboxUseCase({
      q: "GLD-9B2",
      error: "boom",
      from: "2026-06-16T00:00:00.000Z",
      to: "2026-06-16T23:59:59.999Z",
    });

    expect(breakdown).toHaveBeenCalledWith({
      q: "GLD-9B2",
      from: "2026-06-16T00:00:00.000Z",
      to: "2026-06-16T23:59:59.999Z",
      audit: undefined,
    });
  });

  // The breakdown IS the list of failures, so narrowing it to one answers its
  // own question with a single group - a caller that has narrowed a page to
  // one error still wants to see what else it could narrow to. The composite
  // page has always read it this way; these two now agree with it.
  it("never applies the error filter it is given", async () => {
    await breakdownInboxUseCase({ error: "boom" });

    expect(breakdown.mock.calls[0][0]).not.toHaveProperty("error");
  });

  it("never passes a status - the scope is pinned to DEAD_LETTER in the repository", async () => {
    await breakdownInboxUseCase({});

    expect(breakdown.mock.calls[0][0]).not.toHaveProperty("status");
    expect(breakdown.mock.calls[0][0]).not.toHaveProperty("kind");
  });

  it("answers with the groups under `groups`", async () => {
    breakdown.mockResolvedValue([
      { error: "boom", type: "t", count: 3, firstAt: null, lastAt: null },
    ]);

    expect(await breakdownInboxUseCase({})).toEqual({
      groups: [
        { error: "boom", type: "t", count: 3, firstAt: null, lastAt: null },
      ],
    });
  });
});

describe("breakdownInboxUseCase audit", () => {
  it("passes the resolved audit mode to the repository", async () => {
    await breakdownInboxUseCase({ audit: "include" });

    expect(breakdown.mock.calls.at(-1)[0].audit).toBe("include");

    await breakdownInboxUseCase({ audit: "exclude" });

    expect(breakdown.mock.calls.at(-1)[0].audit).toBe("exclude");
  });
});
