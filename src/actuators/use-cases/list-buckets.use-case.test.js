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

    expect(await listBucketsUseCase({ withFields: false })).toEqual({
      buckets: [
        { id: "cw.outbox", facts: [] },
        { id: "cw.cases", facts: [] },
      ],
    });
    expect(describeBucket.mock.calls).toEqual([
      [outbox, { withFields: false }],
      [cases, { withFields: false }],
    ]);
  });

  it("describes the fields of each bucket when asked for them", async () => {
    const cases = { id: "cw.cases" };
    listBuckets.mockReturnValue([cases]);
    describeBucket.mockResolvedValue({ id: "cw.cases", fields: null });

    await listBucketsUseCase({ withFields: true });

    expect(describeBucket).toHaveBeenCalledWith(cases, { withFields: true });
  });

  it("answers no buckets when none is registered", async () => {
    listBuckets.mockReturnValue([]);

    expect(await listBucketsUseCase({ withFields: false })).toEqual({
      buckets: [],
    });
  });

  it("fails as a whole when a bucket cannot be described", async () => {
    listBuckets.mockReturnValue([{ id: "cw.cases" }]);
    describeBucket.mockRejectedValue(new Error("read failed"));

    await expect(listBucketsUseCase({ withFields: false })).rejects.toThrow(
      "read failed",
    );
  });
});
