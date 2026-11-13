import { beforeEach, describe, expect, it, vi } from "vitest";
import { casesBucket } from "../../cases/buckets/cases.bucket.js";
import { inboxBucket } from "../../cases/buckets/inbox.bucket.js";
import { outboxBucket } from "../../cases/buckets/outbox.bucket.js";
import { workflowsBucket } from "../../cases/buckets/workflows.bucket.js";
import { casesSource } from "../../cases/explore/cases.source.js";
import { workflowsSource } from "../../cases/explore/workflows.source.js";
import { findNewestWorkflows } from "../../cases/repositories/workflow.repository.js";
import {
  readStoredValues,
  readValueCounts,
} from "../../common/buckets/engine.js";
import { clearBuckets, registerBucket } from "../../common/buckets/registry.js";
import {
  clearExploreSources,
  registerExploreSource,
} from "../../common/explore-sources/registry.js";
import { sourcesSchema } from "../../common/explore/query-schema.js";
import { eventsSource } from "../../events/explore/events.source.js";
import { MAX_ANSWER_PATHS } from "../explore/answer-paths.js";
import { forgetAnswerList } from "./load-answer-list.use-case.js";
import { exploreSourcesUseCase } from "./explore-sources.use-case.js";

vi.mock("../../cases/repositories/workflow.repository.js");
vi.mock("../../common/buckets/engine.js", async (importOriginal) => ({
  ...(await importOriginal()),
  readStoredValues: vi.fn(),
  readValueCounts: vi.fn(),
}));

beforeEach(() => {
  clearBuckets();
  [outboxBucket(), inboxBucket(), casesBucket(), workflowsBucket()].forEach(
    registerBucket,
  );
  clearExploreSources();
  [casesSource, workflowsSource, eventsSource].forEach(registerExploreSource);
  forgetAnswerList();
  findNewestWorkflows.mockResolvedValue([
    { code: "woodland", pages: { t: "$.payload.answers.woodlandName" } },
  ]);
  readStoredValues.mockResolvedValue(["woodland", "frps-private-beta"]);
  readValueCounts.mockResolvedValue(null);
});

describe("exploreSourcesUseCase", () => {
  it("fails when its workflows can't be read", async () => {
    findNewestWorkflows.mockRejectedValueOnce(new Error("Mongo down"));

    await expect(exploreSourcesUseCase()).rejects.toThrow("Mongo down");
  });

  it("answers within its schema past as many answer paths as it carries", async () => {
    findNewestWorkflows.mockResolvedValue([
      {
        code: "big",
        pages: Array.from(
          { length: MAX_ANSWER_PATHS + 10 },
          (_, n) => `$.payload.answers.answer${n}`,
        ),
      },
    ]);

    const answer = await exploreSourcesUseCase();

    expect(sourcesSchema.validate(answer).error).toBeUndefined();
    expect(answer.sources[0].answerPaths).toHaveLength(MAX_ANSWER_PATHS);
  });
});
