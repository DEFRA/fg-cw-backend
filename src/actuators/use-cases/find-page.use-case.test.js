import { beforeEach, describe, expect, it, vi } from "vitest";
import { breakdownInboxUseCase } from "./breakdown-inbox.use-case.js";
import { breakdownOutboxUseCase } from "./breakdown-outbox.use-case.js";
import { countInboxUseCase } from "./count-inbox.use-case.js";
import { countOutboxUseCase } from "./count-outbox.use-case.js";
import { findInboxPageUseCase } from "./find-inbox-page.use-case.js";
import { findOutboxPageUseCase } from "./find-outbox-page.use-case.js";
import { findPageUseCase } from "./find-page.use-case.js";

vi.mock("../../common/mongo-client.js");
vi.mock("./breakdown-inbox.use-case.js");
vi.mock("./breakdown-outbox.use-case.js");
vi.mock("./count-inbox.use-case.js");
vi.mock("./count-outbox.use-case.js");
vi.mock("./find-inbox-page.use-case.js");
vi.mock("./find-outbox-page.use-case.js");

const pagination = {
  startCursor: "IN",
  endCursor: "OUT",
  hasNextPage: false,
  hasPreviousPage: false,
};

const aPage = (rows = [{ _id: "665f1c2e9a1b2c3d4e5f6a7b" }]) => ({
  data: rows,
  pagination,
});

const counts = {
  PUBLISHED: 1,
  PROCESSING: 0,
  FAILED: 0,
  RESUBMITTED: 0,
  COMPLETED: 2,
  DEAD_LETTER: 3,
};

const groups = [
  {
    error: "boom",
    type: "case.create",
    audit: false,
    count: 3,
    firstAt: null,
    lastAt: null,
  },
];

const givenBothBoxesAnswer = () => {
  findInboxPageUseCase.mockResolvedValue(aPage());
  findOutboxPageUseCase.mockResolvedValue(aPage());
  countInboxUseCase.mockResolvedValue({ counts });
  countOutboxUseCase.mockResolvedValue({ counts });
  breakdownInboxUseCase.mockResolvedValue({ groups });
  breakdownOutboxUseCase.mockResolvedValue({ groups });
};

describe("findPageUseCase", () => {
  beforeEach(givenBothBoxesAnswer);

  it("answers with both boxes in one read", async () => {
    const page = await findPageUseCase({});

    expect(page.inbox).toEqual({
      events: [{ _id: "665f1c2e9a1b2c3d4e5f6a7b" }],
      pagination,
      counts,
      breakdown: { groups },
    });
    expect(page.outbox).toEqual(page.inbox);
    expect(page.sectionErrors).toEqual([]);
  });

  it("takes a cursor per box, and gives each box its own", async () => {
    await findPageUseCase({ inboxCursor: "IN-2", outboxCursor: "OUT-9" });

    expect(findInboxPageUseCase).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: "IN-2" }),
    );
    expect(findOutboxPageUseCase).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: "OUT-9" }),
    );
  });

  it("asks both boxes the same question", async () => {
    await findPageUseCase({
      q: "GLD-9B2",
      error: "boom",
      from: "2026-06-16T00:00:00.000Z",
      to: "2026-06-17T00:00:00.000Z",
      audit: "include",
      status: "DEAD_LETTER",
      pageSize: 5,
      direction: "backward",
    });

    const selection = {
      q: "GLD-9B2",
      error: "boom",
      from: "2026-06-16T00:00:00.000Z",
      to: "2026-06-17T00:00:00.000Z",
      audit: "include",
    };

    expect(findInboxPageUseCase).toHaveBeenCalledWith({
      ...selection,
      status: "DEAD_LETTER",
      pageSize: 5,
      direction: "backward",
      cursor: undefined,
    });
    expect(countInboxUseCase).toHaveBeenCalledWith(selection);

    const { error, ...withoutError } = selection;

    expect(breakdownOutboxUseCase).toHaveBeenCalledWith(withoutError);
    expect(error).toBe("boom");
  });

  it("keeps the error filter off the breakdown", async () => {
    await findPageUseCase({ error: "boom" });

    expect(breakdownInboxUseCase).toHaveBeenCalledWith(
      expect.not.objectContaining({ error: expect.anything() }),
    );
    expect(countInboxUseCase).toHaveBeenCalledWith(
      expect.objectContaining({ error: "boom" }),
    );
  });

  it("keeps the status filter off the figures", async () => {
    await findPageUseCase({ status: "FAILED" });

    expect(countInboxUseCase).toHaveBeenCalledWith(
      expect.not.objectContaining({ status: expect.anything() }),
    );
    expect(breakdownInboxUseCase).toHaveBeenCalledWith(
      expect.not.objectContaining({ status: expect.anything() }),
    );
  });

  it.each([
    [
      "counts",
      "inbox",
      () => countInboxUseCase.mockRejectedValue(new Error("boom")),
    ],
    [
      "breakdown",
      "outbox",
      () => breakdownOutboxUseCase.mockRejectedValue(new Error("boom")),
    ],
  ])(
    "nulls a %s that failed on %s and names it, rather than losing the page",
    async (section, box, fail) => {
      fail();

      const page = await findPageUseCase({});

      expect(page[box][section]).toBeNull();
      expect(page.sectionErrors).toEqual([
        { box, section, message: "read failed" },
      ]);
      expect(page[box].events).toHaveLength(1);
    },
  );

  it("nulls one box's list and keeps the other's", async () => {
    findInboxPageUseCase.mockRejectedValue(new Error("boom"));

    const page = await findPageUseCase({});

    expect(page.inbox.events).toBeNull();
    expect(page.inbox.pagination).toBeNull();
    expect(page.outbox.events).toHaveLength(1);
    expect(page.sectionErrors).toEqual([
      { box: "inbox", section: "list", message: "read failed" },
    ]);
  });

  it("fails the call when neither box could be read", async () => {
    findInboxPageUseCase.mockRejectedValue(new Error("boom"));
    findOutboxPageUseCase.mockRejectedValue(new Error("boom"));

    await expect(findPageUseCase({})).rejects.toMatchObject({
      output: { statusCode: 502 },
    });
  });

  it("names every section that failed", async () => {
    countInboxUseCase.mockRejectedValue(new Error("boom"));
    breakdownInboxUseCase.mockRejectedValue(new Error("boom"));
    breakdownOutboxUseCase.mockRejectedValue(new Error("boom"));

    const { sectionErrors } = await findPageUseCase({});

    expect(sectionErrors).toEqual([
      { box: "inbox", section: "counts", message: "read failed" },
      { box: "inbox", section: "breakdown", message: "read failed" },
      { box: "outbox", section: "breakdown", message: "read failed" },
    ]);
  });

  // A failed section reports a fixed one-liner: nothing the store said
  // reaches a caller.
  it("says nothing a driver said", async () => {
    countOutboxUseCase.mockRejectedValue(
      new Error("E11000 duplicate key error collection: cw.inbox"),
    );

    const { sectionErrors } = await findPageUseCase({});

    expect(sectionErrors[0].message).toBe("read failed");
  });

  // Awaiting the sections one at a time would pay serially the round trips the
  // composite exists to avoid.
  it("starts every section before waiting on any of them", async () => {
    const started = [];
    const hold = () => new Promise(() => {});
    const record = (name) => () => {
      started.push(name);

      return hold();
    };

    findInboxPageUseCase.mockImplementation(record("inbox list"));
    findOutboxPageUseCase.mockImplementation(record("outbox list"));
    countInboxUseCase.mockImplementation(record("inbox counts"));
    countOutboxUseCase.mockImplementation(record("outbox counts"));
    breakdownInboxUseCase.mockImplementation(record("inbox breakdown"));
    breakdownOutboxUseCase.mockImplementation(record("outbox breakdown"));

    findPageUseCase({});
    await Promise.resolve();

    expect(started).toHaveLength(6);
  });
});
