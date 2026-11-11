import { beforeEach, describe, expect, it, vi } from "vitest";
import { countBins } from "../../common/buckets/bins.js";
import { COUNT_CAP } from "../../common/buckets/engine.js";
import { listBuckets } from "../../common/buckets/registry.js";
import { testBucket } from "../../common/buckets/test-bucket.js";
import { countDeadLettersUseCase } from "./count-dead-letters.use-case.js";

vi.mock("../../common/buckets/bins.js");
vi.mock("../../common/buckets/registry.js");
vi.mock("../../common/logger.js", () => ({ logger: { info: vi.fn() } }));

const WINDOW = {
  from: "2026-10-08T12:00:00.000Z",
  to: "2026-10-09T12:00:00.000Z",
};

const BINS = [
  {
    from: WINDOW.from,
    to: "2026-10-08T14:00:00.000Z",
    count: 2,
    capped: false,
  },
];

const BIN_MS = 2 * 60 * 60 * 1000;
const DEAD_LETTERS = { among: { status: "DEAD_LETTER" } };

const outbox = testBucket({
  id: "cw.outbox",
  path: "events/cw/outbox",
  bins: DEAD_LETTERS,
});
const inbox = testBucket({
  id: "cw.inbox",
  path: "events/cw/inbox",
  bins: DEAD_LETTERS,
});
// Offers DEAD_LETTER, but declares no bins of it.
const statusOnly = testBucket({ id: "cw.statuses", path: "statuses" });
const cases = testBucket({
  id: "cw.cases",
  path: "cases",
  facts: { code: { label: "Code", param: "code", values: "stored" } },
  indexes: [["code"]],
  groupings: [],
  columns: [],
});

describe("countDeadLettersUseCase", () => {
  beforeEach(() => {
    listBuckets.mockReturnValue([outbox, statusOnly, inbox, cases]);
    countBins.mockResolvedValue(BINS);
  });

  it("counts every bucket that declares bins of its dead letters, in order, in two-hour bins", async () => {
    expect(await countDeadLettersUseCase(WINDOW)).toEqual({
      ...WINDOW,
      countCap: COUNT_CAP,
      buckets: [
        {
          id: "cw.outbox",
          list: {
            path: "events/cw/outbox",
            query: { status: "DEAD_LETTER" },
          },
          bins: BINS,
        },
        {
          id: "cw.inbox",
          list: { path: "events/cw/inbox", query: { status: "DEAD_LETTER" } },
          bins: BINS,
        },
      ],
    });
    expect(countBins).toHaveBeenCalledTimes(2);
    expect(countBins).toHaveBeenCalledWith(outbox, {
      where: { status: "DEAD_LETTER" },
      ...WINDOW,
      binMs: BIN_MS,
    });
  });

  it("fails whole when a bucket cannot be counted", async () => {
    countBins.mockRejectedValueOnce(new Error("read failed"));

    await expect(countDeadLettersUseCase(WINDOW)).rejects.toThrow(
      "read failed",
    );
  });

  it("counts a window of a week", async () => {
    const week = {
      from: "2026-10-01T12:00:00.000Z",
      to: "2026-10-08T12:00:00.000Z",
    };

    expect(await countDeadLettersUseCase(week)).toMatchObject(week);
  });

  it.each([
    [
      "a window that ends before it starts",
      { from: WINDOW.to, to: WINDOW.from },
      "INVALID_RANGE",
    ],
    [
      "a window longer than a week",
      { from: "2026-10-01T12:00:00.000Z", to: "2026-10-08T12:00:00.001Z" },
      "INVALID_REQUEST",
    ],
  ])("refuses %s, reading nothing", async (_, window, reason) => {
    await expect(countDeadLettersUseCase(window)).rejects.toMatchObject({
      output: { statusCode: 400, payload: { reason } },
    });
    expect(countBins).not.toHaveBeenCalled();
  });
});
