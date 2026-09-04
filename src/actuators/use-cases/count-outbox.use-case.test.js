import { describe, expect, it, vi } from "vitest";
import { countFacets } from "../../cases/repositories/outbox.repository.js";
import { countOutboxUseCase } from "./count-outbox.use-case.js";

vi.mock("../../common/mongo-client.js");
vi.mock("../../cases/repositories/outbox.repository.js");

const someCounts = () => ({
  PUBLISHED: 1,
  PROCESSING: 0,
  FAILED: 2,
  RESUBMITTED: 0,
  COMPLETED: 9,
  DEAD_LETTER: 3,
  PARKED: 0,
});

const someFacets = () => ({ counts: someCounts() });

describe("countOutboxUseCase", () => {
  it("answers with the repository's counts", async () => {
    countFacets.mockResolvedValue(someFacets());

    expect(await countOutboxUseCase({})).toEqual(someFacets());
  });

  it("passes q, error, from and to to the repository", async () => {
    countFacets.mockResolvedValue(someFacets());

    await countOutboxUseCase({
      q: "GLD-9B2",
      error: "boom",
      from: "2026-06-16T00:00:00.000Z",
      to: "2026-06-16T23:59:59.999Z",
    });

    expect(countFacets).toHaveBeenCalledWith({
      q: "GLD-9B2",
      error: "boom",
      from: "2026-06-16T00:00:00.000Z",
      to: "2026-06-16T23:59:59.999Z",
    });
  });

  it("never passes a cursor, a page size or a status", async () => {
    countFacets.mockResolvedValue(someFacets());

    await countOutboxUseCase({});

    expect(Object.keys(countFacets.mock.calls.at(-1)[0])).toEqual([
      "q",
      "error",
      "from",
      "to",
    ]);
  });

  // The TYPE facet is gone with the filter it described: one block, one call,
  // and no `kind` is ever handed to the repository.
  it("answers the box in ONE repository call, with no byKind block", async () => {
    countFacets.mockResolvedValue(someFacets());

    const result = await countOutboxUseCase({});

    expect(countFacets).toHaveBeenCalledTimes(1);
    expect(result).not.toHaveProperty("byKind");
    expect(countFacets.mock.calls[0][0]).not.toHaveProperty("kind");
  });
});
