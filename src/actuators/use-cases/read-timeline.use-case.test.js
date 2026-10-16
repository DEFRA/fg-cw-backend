import { describe, expect, it, vi } from "vitest";
import { readTimeline } from "../../common/buckets/engine.js";
import { logger } from "../../common/logger.js";
import { readTimelineUseCase } from "./read-timeline.use-case.js";

vi.mock("../../common/buckets/engine.js");
vi.mock("../../common/logger.js", () => ({ logger: { info: vi.fn() } }));

describe("readTimelineUseCase", () => {
  it("answers this service's timeline for the ref, logging no value", async () => {
    const timeline = { buckets: [] };
    readTimeline.mockResolvedValue(timeline);

    await expect(readTimelineUseCase({ ref: "ref:abc-123" })).resolves.toBe(
      timeline,
    );
    expect(readTimeline).toHaveBeenCalledExactlyOnceWith("ref:abc-123");
    expect(JSON.stringify(logger.info.mock.calls)).not.toContain("abc-123");
  });
});
