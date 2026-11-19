import { beforeEach, describe, expect, it, vi } from "vitest";
import { findNewestWorkflows } from "../../cases/repositories/workflow.repository.js";
import { logger } from "../../common/logger.js";
import { MAX_ANSWER_PATHS } from "../explore/answer-paths.js";
import {
  forgetAnswerList,
  loadAnswerListUseCase,
} from "./load-answer-list.use-case.js";

vi.mock("../../cases/repositories/workflow.repository.js");
vi.mock("../../common/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

beforeEach(() => {
  forgetAnswerList();
});

describe("loadAnswerListUseCase", () => {
  it("lists the answers the stored workflows reference", async () => {
    findNewestWorkflows.mockResolvedValue([
      { code: "woodland", pages: { text: "$.payload.answers.woodlandName" } },
    ]);

    const { paths, isListed } = await loadAnswerListUseCase();

    expect(paths).toContain("woodlandName");
    expect(isListed("woodlandName")).toBe(true);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("logs when the list is cut short, naming no path", async () => {
    findNewestWorkflows.mockResolvedValue([
      {
        code: "big",
        pages: Array.from(
          { length: MAX_ANSWER_PATHS },
          (_, n) => `$.payload.answers.secretish${n}`,
        ),
      },
    ]);

    const { paths } = await loadAnswerListUseCase();

    expect(paths).toHaveLength(MAX_ANSWER_PATHS);
    expect(logger.warn).toHaveBeenCalledWith(
      `Explore answer list cut to ${MAX_ANSWER_PATHS} paths`,
    );
  });

  it("is kept 5 minutes, and a failure never is", async () => {
    vi.useFakeTimers();
    findNewestWorkflows.mockRejectedValueOnce(new Error("Mongo down"));

    await expect(loadAnswerListUseCase()).rejects.toThrow("Mongo down");

    findNewestWorkflows.mockResolvedValue([]);
    await loadAnswerListUseCase();
    await loadAnswerListUseCase();
    expect(findNewestWorkflows).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(5 * 60 * 1000);
    await loadAnswerListUseCase();
    expect(findNewestWorkflows).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });
});
