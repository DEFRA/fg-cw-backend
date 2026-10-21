import { describe, expect, it, vi } from "vitest";
import { describeBucket } from "../../common/buckets/catalogue.js";
import { listBuckets } from "../../common/buckets/registry.js";
import { listBucketsUseCase } from "./list-buckets.use-case.js";

vi.mock("../../common/buckets/catalogue.js");
vi.mock("../../common/buckets/registry.js");

describe("listBucketsUseCase", () => {
  it("describes every registered bucket, in the registry's order", async () => {
    const outbox = { id: "cw.outbox" };
    const cases = { id: "cw.cases" };
    listBuckets.mockReturnValue([outbox, cases]);
    describeBucket.mockImplementation(async ({ id }) => ({ id, facts: [] }));

    expect(await listBucketsUseCase()).toEqual({
      buckets: [
        { id: "cw.outbox", facts: [] },
        { id: "cw.cases", facts: [] },
      ],
    });
    expect(describeBucket.mock.calls.map(([bucket]) => bucket)).toEqual([
      outbox,
      cases,
    ]);
  });

  it("answers no buckets when none is registered", async () => {
    listBuckets.mockReturnValue([]);

    expect(await listBucketsUseCase()).toEqual({ buckets: [] });
  });

  it("fails as a whole when a bucket cannot be described", async () => {
    listBuckets.mockReturnValue([{ id: "cw.cases" }]);
    describeBucket.mockRejectedValue(new Error("read failed"));

    await expect(listBucketsUseCase()).rejects.toThrow("read failed");
  });
});
