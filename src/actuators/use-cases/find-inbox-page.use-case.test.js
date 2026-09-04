import { describe, expect, it, vi } from "vitest";
import { findPage } from "../../cases/repositories/inbox.repository.js";
import { findInboxPageUseCase } from "./find-inbox-page.use-case.js";

vi.mock("../../common/mongo-client.js");
vi.mock("../../cases/repositories/inbox.repository.js");

// distinct caps per box, set before config.js reads the environment, so the
// inbox use case cannot silently read the outbox cap
vi.hoisted(() => {
  process.env.INBOX_MAX_RETRIES = "7";
  process.env.OUTBOX_MAX_RETRIES = "9";
});

const aPage = (data) => ({
  data,
  pagination: {
    startCursor: "start",
    endCursor: "end",
    hasNextPage: true,
    hasPreviousPage: false,
  },
});

const aRow = (overrides = {}) => ({
  _id: "665f1c2e9a1b2c3d4e5f6a7b",
  eventId: "msg-1",
  type: "cloud.defra.prd.fg-gas-backend.case.create.new",
  source: "GAS",
  segregationRef: "GLD-9B2",
  status: "PUBLISHED",
  completionAttempts: 1,
  traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
  createdAt: "2026-06-16T10:00:00.000Z",
  lastFailureAt: null,
  completedAt: null,
  ...overrides,
});

describe("findInboxPageUseCase", () => {
  it("passes cursor, direction, pageSize and status through", async () => {
    findPage.mockResolvedValue(aPage([]));

    await findInboxPageUseCase({
      cursor: "abc",
      direction: "backward",
      pageSize: 10,
      status: "DEAD_LETTER",
    });

    expect(findPage).toHaveBeenCalledWith({
      cursor: "abc",
      direction: "backward",
      pageSize: 10,
      status: "DEAD_LETTER",
    });
  });

  it("returns the repository pagination envelope unchanged", async () => {
    const page = aPage([]);
    findPage.mockResolvedValue(page);

    const result = await findInboxPageUseCase({
      direction: "forward",
      pageSize: 20,
    });

    expect(result.pagination).toEqual(page.pagination);
    expect(result.pagination).not.toHaveProperty("totalCount");
  });

  it("stamps maxAttempts on every row", async () => {
    findPage.mockResolvedValue(aPage([aRow(), aRow({ eventId: "msg-2" })]));

    const result = await findInboxPageUseCase({
      direction: "forward",
      pageSize: 20,
    });

    expect(result.data).toHaveLength(2);
    for (const row of result.data) {
      expect(row.maxAttempts).toBe(7);
    }
  });

  it("reads maxAttempts from the inbox retry config", async () => {
    findPage.mockResolvedValue(aPage([aRow()]));

    const result = await findInboxPageUseCase({
      direction: "forward",
      pageSize: 20,
    });

    expect(result.data[0].maxAttempts).toBe(7);
  });

  it("returns maxAttempts as a number, not a string", async () => {
    findPage.mockResolvedValue(aPage([aRow()]));

    const result = await findInboxPageUseCase({
      direction: "forward",
      pageSize: 20,
    });

    expect(typeof result.data[0].maxAttempts).toBe("number");
  });

  it("leaves the rest of each row untouched", async () => {
    findPage.mockResolvedValue(aPage([aRow()]));

    const result = await findInboxPageUseCase({
      direction: "forward",
      pageSize: 20,
    });

    expect(result.data[0]).toEqual({ ...aRow(), maxAttempts: 7 });
  });

  it("carries the row's traceparent through untouched", async () => {
    findPage.mockResolvedValue(aPage([aRow()]));

    const result = await findInboxPageUseCase({
      direction: "forward",
      pageSize: 20,
    });

    expect(result.data[0].traceparent).toBe(
      "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
    );
  });

  it("carries a null traceparent through as null", async () => {
    findPage.mockResolvedValue(aPage([aRow({ traceparent: null })]));

    const result = await findInboxPageUseCase({
      direction: "forward",
      pageSize: 20,
    });

    expect(result.data[0].traceparent).toBeNull();
  });

  it("returns an empty data array untouched when the page is empty", async () => {
    findPage.mockResolvedValue(aPage([]));

    const result = await findInboxPageUseCase({
      direction: "forward",
      pageSize: 20,
    });

    expect(result.data).toEqual([]);
  });
});

describe("findInboxPageUseCase q", () => {
  it("passes q through to the repository", async () => {
    findPage.mockResolvedValue(aPage([]));

    await findInboxPageUseCase({
      direction: "forward",
      pageSize: 20,
      q: "GLD-9B2",
    });

    expect(findPage).toHaveBeenCalledWith(
      expect.objectContaining({ q: "GLD-9B2" }),
    );
  });

  it("passes q as undefined when it is not given", async () => {
    findPage.mockResolvedValue(aPage([]));

    await findInboxPageUseCase({ direction: "forward", pageSize: 20 });

    expect(findPage).toHaveBeenCalledWith(
      expect.objectContaining({ q: undefined }),
    );
  });

  // The TYPE filter is gone: nothing about kind reaches the repository.
  it("never passes a kind to the repository", async () => {
    findPage.mockResolvedValue(aPage([]));

    await findInboxPageUseCase({
      direction: "forward",
      pageSize: 20,
      q: "GLD-9B2",
    });

    expect(findPage.mock.calls.at(-1)[0]).not.toHaveProperty("kind");
  });

  it("carries a row's lastError through untouched", async () => {
    const lastError = {
      name: "ClaimExpired",
      message: "claim expired before completion",
      at: "2026-06-16T10:16:05.000Z",
    };
    findPage.mockResolvedValue(aPage([aRow({ lastError })]));

    const result = await findInboxPageUseCase({
      direction: "forward",
      pageSize: 20,
    });

    expect(result.data[0].lastError).toEqual(lastError);
  });
});

describe("findInboxPageUseCase from and to", () => {
  it("passes both bounds through to the repository", async () => {
    findPage.mockResolvedValue(aPage([]));

    await findInboxPageUseCase({
      direction: "forward",
      pageSize: 20,
      from: "2026-06-16T00:00:00.000Z",
      to: "2026-06-16T23:59:59.999Z",
    });

    expect(findPage).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "2026-06-16T00:00:00.000Z",
        to: "2026-06-16T23:59:59.999Z",
      }),
    );
  });
});
