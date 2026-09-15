import { beforeEach, describe, expect, it, vi } from "vitest";
import { logger } from "../../common/logger.js";
import { breakdownInboxUseCase } from "./breakdown-inbox.use-case.js";
import { breakdownOutboxUseCase } from "./breakdown-outbox.use-case.js";
import { countInboxUseCase } from "./count-inbox.use-case.js";
import { countOutboxUseCase } from "./count-outbox.use-case.js";
import { findPage as findInboxPage } from "../../cases/repositories/inbox.repository.js";
import { findPage as findOutboxPage } from "../../cases/repositories/outbox.repository.js";
import { findPageUseCase } from "./find-page.use-case.js";

vi.mock("../../common/mongo-client.js");
vi.mock("./breakdown-inbox.use-case.js");
vi.mock("./breakdown-outbox.use-case.js");
vi.mock("./count-inbox.use-case.js");
vi.mock("./count-outbox.use-case.js");
vi.mock("../../cases/repositories/inbox.repository.js");
vi.mock("../../cases/repositories/outbox.repository.js");

const pagination = {
  startCursor: "IN",
  endCursor: "OUT",
  hasNextPage: true,
  hasPreviousPage: false,
};

const served = { hasNextPage: true };

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
  findInboxPage.mockResolvedValue(aPage());
  findOutboxPage.mockResolvedValue(aPage());
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
      pagination: served,
      counts,
      breakdown: { groups },
    });
    expect(page.outbox).toEqual(page.inbox);
  });

  it("takes a cursor per box, and gives each box its own", async () => {
    await findPageUseCase({ inboxCursor: "IN-2", outboxCursor: "OUT-9" });

    expect(findInboxPage).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: "IN-2" }),
    );
    expect(findOutboxPage).toHaveBeenCalledWith(
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
    });

    const selection = {
      q: "GLD-9B2",
      error: "boom",
      from: "2026-06-16T00:00:00.000Z",
      to: "2026-06-17T00:00:00.000Z",
      audit: "include",
    };

    expect(findInboxPage).toHaveBeenCalledWith({
      ...selection,
      status: "DEAD_LETTER",
      pageSize: 5,
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
    "nulls a %s that failed on %s, rather than losing the page",
    async (section, box, fail) => {
      fail();

      const page = await findPageUseCase({});

      expect(page[box][section]).toBeNull();
      expect(page[box].events).toHaveLength(1);
    },
  );

  it("nulls one box's list and keeps the other's", async () => {
    findInboxPage.mockRejectedValue(new Error("boom"));

    const page = await findPageUseCase({});

    expect(page.inbox.events).toBeNull();
    expect(page.inbox.pagination).toBeNull();
    expect(page.outbox.events).toHaveLength(1);
  });

  it("fails the call when neither box could be read", async () => {
    findInboxPage.mockRejectedValue(new Error("boom"));
    findOutboxPage.mockRejectedValue(new Error("boom"));

    await expect(findPageUseCase({})).rejects.toMatchObject({
      output: { statusCode: 502 },
    });
  });

  const ROW = { _id: "665f1c2e9a1b2c3d4e5f6a7b" };

  const queriedTimes = () => ({
    list: [findInboxPage, findOutboxPage].map(timesCalled),
    counts: [countInboxUseCase, countOutboxUseCase].map(timesCalled),
    breakdown: [breakdownInboxUseCase, breakdownOutboxUseCase].map(timesCalled),
  });

  const timesCalled = (read) => read.mock.calls.length;

  const sectionsOf = (section) => ({
    events: section.events,
    counts: section.counts,
    breakdown: section.breakdown,
  });

  it.each([
    [
      ["list"],
      { list: [1, 1], counts: [0, 0], breakdown: [0, 0] },
      { events: [ROW], counts: null, breakdown: null },
    ],
    [
      ["list", "counts"],
      { list: [1, 1], counts: [1, 1], breakdown: [0, 0] },
      { events: [ROW], counts, breakdown: null },
    ],
    [
      ["counts", "breakdown"],
      { list: [0, 0], counts: [1, 1], breakdown: [1, 1] },
      { events: null, counts, breakdown: { groups } },
    ],
  ])(
    "queries only the sections asked for (%j) and nulls the rest",
    async (sections, queried, section) => {
      const error = vi.spyOn(logger, "error");

      const page = await findPageUseCase({ sections });

      expect(queriedTimes()).toEqual(queried);
      expect(sectionsOf(page.inbox)).toEqual(section);
      expect(sectionsOf(page.outbox)).toEqual(section);
      expect(error).not.toHaveBeenCalled();
    },
  );

  it("does not fail the call for lists that were not asked for", async () => {
    await expect(
      findPageUseCase({ sections: ["counts"] }),
    ).resolves.toMatchObject({ inbox: { events: null, pagination: null } });
  });

  it("logs and nulls a requested section that fails", async () => {
    const error = vi.spyOn(logger, "error");
    countInboxUseCase.mockRejectedValue(new Error("boom"));

    const page = await findPageUseCase({ sections: ["list", "counts"] });

    expect(page.inbox.counts).toBeNull();
    expect(error).toHaveBeenCalledTimes(1);
  });

  // Serial awaits would pay the round trips the composite exists to avoid.
  it("starts every section before waiting on any of them", async () => {
    const started = [];
    const hold = () => new Promise(() => {});
    const record = (name) => () => {
      started.push(name);

      return hold();
    };

    findInboxPage.mockImplementation(record("inbox list"));
    findOutboxPage.mockImplementation(record("outbox list"));
    countInboxUseCase.mockImplementation(record("inbox counts"));
    countOutboxUseCase.mockImplementation(record("outbox counts"));
    breakdownInboxUseCase.mockImplementation(record("inbox breakdown"));
    breakdownOutboxUseCase.mockImplementation(record("outbox breakdown"));

    findPageUseCase({});
    await Promise.resolve();

    expect(started).toHaveLength(6);
  });
});
