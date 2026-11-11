import { beforeEach, describe, expect, it, vi } from "vitest";
import { countBins } from "../../common/buckets/bins.js";
import { COUNT_CAP } from "../../common/buckets/engine.js";
import { listBuckets } from "../../common/buckets/registry.js";
import { testBucket } from "../../common/buckets/test-bucket.js";
import {
  BIN_MS,
  countDeadLettersUseCase,
} from "./count-dead-letters.use-case.js";

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

const outbox = testBucket({ id: "cw.outbox", path: "events/cw/outbox" });
const inbox = testBucket({ id: "cw.inbox", path: "events/cw/inbox" });
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
    listBuckets.mockReturnValue([outbox, inbox, cases]);
    countBins.mockResolvedValue(BINS);
  });

  it("counts every bucket that holds dead letters, in order, in two-hour bins", async () => {
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
    expect(BIN_MS).toBe(2 * 60 * 60 * 1000);
  });

  it("fails whole when a bucket cannot be counted", async () => {
    countBins.mockRejectedValueOnce(new Error("read failed"));

    await expect(countDeadLettersUseCase(WINDOW)).rejects.toThrow(
      "read failed",
    );
  });
});
