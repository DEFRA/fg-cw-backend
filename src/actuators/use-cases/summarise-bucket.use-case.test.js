import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseSummary, runSummary } from "../../common/buckets/summary.js";
import { refuse } from "../../common/buckets/refusal.js";
import { findBucket } from "../../common/buckets/registry.js";
import { summariseBucketUseCase } from "./summarise-bucket.use-case.js";

vi.mock("../../common/buckets/summary.js");
vi.mock("../../common/buckets/registry.js");
vi.mock("../../common/logger.js", () => ({ logger: { info: vi.fn() } }));

const BODY = { from: "2026-10-08T12:00:00.000Z" };
const QUERY = { summary: { id: "errors" }, from: BODY.from, to: undefined };
const RESULT = { bucket: "cw.inbox", summary: "errors", entries: [] };

const reasonOf = (reason) =>
  expect.objectContaining({
    output: expect.objectContaining({
      payload: expect.objectContaining({ reason }),
    }),
  });

const ask = (bucketId, summaryId = "errors") =>
  summariseBucketUseCase({ bucketId, summaryId, body: BODY });

describe("summariseBucketUseCase", () => {
  beforeEach(() => {
    parseSummary.mockReturnValue(QUERY);
    runSummary.mockResolvedValue(RESULT);
  });

  it("reads a summary the bucket declares", async () => {
    const bucket = { id: "cw.inbox" };
    findBucket.mockReturnValue(bucket);

    expect(await ask("cw.inbox")).toBe(RESULT);
    expect(parseSummary).toHaveBeenCalledWith(bucket, "errors", BODY);
    expect(runSummary).toHaveBeenCalledWith(bucket, QUERY);
  });

  it("refuses before the read a summary the bucket does not declare", async () => {
    findBucket.mockReturnValue({ id: "cw.inbox" });
    parseSummary.mockImplementation(() => {
      throw refuse("UNKNOWN_SUMMARY");
    });

    await expect(ask("cw.inbox", "nothing")).rejects.toThrow(
      reasonOf("UNKNOWN_SUMMARY"),
    );
    expect(runSummary).not.toHaveBeenCalled();
  });

  it.each([
    ["a bucket nobody registered", "cw.nothing"],
    ["a malformed id", "CW.Inbox"],
  ])("refuses UNKNOWN_BUCKET for %s", async (_, bucketId) => {
    findBucket.mockReturnValue(undefined);

    await expect(ask(bucketId)).rejects.toThrow(reasonOf("UNKNOWN_BUCKET"));
    expect(runSummary).not.toHaveBeenCalled();
  });
});
