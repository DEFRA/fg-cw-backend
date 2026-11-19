import { beforeEach, describe, expect, it, vi } from "vitest";
import { casesBucket } from "../../cases/buckets/cases.bucket.js";
import { inboxBucket } from "../../cases/buckets/inbox.bucket.js";
import { outboxBucket } from "../../cases/buckets/outbox.bucket.js";
import { workflowsBucket } from "../../cases/buckets/workflows.bucket.js";
import { casesSource } from "../../cases/explore/cases.source.js";
import { workflowsSource } from "../../cases/explore/workflows.source.js";
import { readStoredValues } from "../../common/buckets/engine.js";
import { clearBuckets, registerBucket } from "../../common/buckets/registry.js";
import {
  clearExploreSources,
  registerExploreSource,
} from "../../common/explore-sources/registry.js";
import { sourcesSchema } from "../../common/explore/query-schema.js";
import { eventsSource } from "../../events/explore/events.source.js";
import { exploreSourcesUseCase } from "./explore-sources.use-case.js";

vi.mock("../../common/buckets/engine.js", async (importOriginal) => ({
  ...(await importOriginal()),
  readStoredValues: vi.fn(),
}));

beforeEach(() => {
  clearBuckets();
  [outboxBucket(), inboxBucket(), casesBucket(), workflowsBucket()].forEach(
    registerBucket,
  );
  clearExploreSources();
  [casesSource, workflowsSource, eventsSource].forEach(registerExploreSource);
  readStoredValues.mockResolvedValue(["woodland", "frps-private-beta"]);
});

describe("exploreSourcesUseCase", () => {
  it("answers within its schema, each source's roots and paths and no answer list", async () => {
    const answer = await exploreSourcesUseCase();

    expect(sourcesSchema.validate(answer).error).toBeUndefined();
    expect(answer.sources.map(({ name }) => name)).toEqual([
      "cases",
      "workflows",
      "events",
    ]);
    for (const source of answer.sources) {
      expect(source).not.toHaveProperty("answerPaths");
      expect(source).not.toHaveProperty("listedAt");
      expect(source).not.toHaveProperty("requires");
    }
  });
});
