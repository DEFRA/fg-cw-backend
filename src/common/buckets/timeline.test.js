import { ObjectId } from "mongodb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { logger } from "../logger.js";
import { db } from "../mongo-client.js";
import { clearBuckets, registerBucket } from "./registry.js";
import { timelineResponseSchema } from "./schema.js";
import { testBucket } from "./test-bucket.js";
import { readBucketTimeline, readTimeline } from "./timeline.js";

vi.mock("../actuator-read.js", () => ({
  actuatorReadMaxTimeMs: () => 5000,
}));
vi.mock("../logger.js", () => ({ logger: { info: vi.fn(), error: vi.fn() } }));
vi.mock("../mongo-client.js", () => ({ db: { collection: vi.fn() } }));

const id = (n) =>
  ObjectId.createFromHexString(n.toString(16).padStart(24, "0"));

const doc = (n) => ({
  _id: id(n),
  publicationDate: new Date(Date.UTC(2026, 9, 9, 9, 0, n)),
  eventType: "case.create",
  status: "COMPLETED",
});

const makeCollection = ({ finds = [] } = {}) => {
  const pending = [...finds];
  const nextFind = async () => (pending.length ? pending.shift() : []);
  const collection = {
    find: vi.fn(() => ({ toArray: vi.fn(nextFind) })),
  };

  db.collection.mockReturnValue(collection);

  return collection;
};

describe("readTimeline", () => {
  const timelineBucket = (id, label, order) =>
    testBucket({ id, label, order, timeline: true });

  beforeEach(() => {
    clearBuckets();
    registerBucket(timelineBucket("test.inbox", "Test inbox", 20));
    registerBucket(timelineBucket("test.outbox", "Test outbox", 10));
    registerBucket(testBucket({ id: "test.records", order: 30 }));
  });

  afterEach(() => {
    clearBuckets();
  });

  it("searches the ref in every timeline bucket registered, 50 from each, and no other", async () => {
    const collection = makeCollection({ finds: [[doc(2), doc(1)], []] });

    const { buckets } = await readTimeline("ref:ABC-123");

    expect(collection.find).toHaveBeenCalledTimes(2);
    expect(collection.find.mock.calls[0]).toEqual([
      { $and: [{ refs: "ref:abc-123" }] },
      expect.objectContaining({
        hint: { refs: 1, publicationDate: -1, _id: -1 },
        limit: 51,
      }),
    ]);
    expect(buckets).toEqual([
      {
        id: "test.outbox",
        label: "Test outbox",
        rows: [
          expect.objectContaining({ id: String(id(2)) }),
          expect.objectContaining({ id: String(id(1)) }),
        ],
        more: false,
      },
      { id: "test.inbox", label: "Test inbox", rows: [], more: false },
    ]);
    expect(timelineResponseSchema.validate({ buckets }).error).toBeUndefined();
  });

  it("reads by a link longer than a searched ref may be", async () => {
    clearBuckets();
    registerBucket(
      testBucket({
        id: "test.outbox",
        label: "Test outbox",
        timeline: true,
        links: ["case"],
      }),
    );
    const collection = makeCollection({ finds: [[doc(1)]] });
    const link = `case:w:${"~41.".repeat(70)}`;

    const { buckets } = await readTimeline(link);

    expect(collection.find.mock.calls[0][0]).toEqual({
      $and: [{ refs: link }],
    });
    expect(buckets[0].rows).toHaveLength(1);
  });

  it("says a bucket has more when its page has a next", async () => {
    makeCollection({
      finds: [Array.from({ length: 51 }, (_, n) => doc(60 - n)), []],
    });

    const { buckets } = await readTimeline("ref:abc-123");

    expect(buckets.map(({ rows, more }) => [rows.length, more])).toEqual([
      [50, true],
      [0, false],
    ]);
  });

  it("answers null rows for a bucket that fails, keeps the rest, and logs no value", async () => {
    const collection = makeCollection();

    collection.find
      .mockImplementationOnce(() => ({
        toArray: vi.fn(async () => {
          throw new Error("SECRET ref:abc-123");
        }),
      }))
      .mockImplementationOnce(() => ({ toArray: vi.fn(async () => [doc(1)]) }));

    const { buckets } = await readTimeline("ref:abc-123");

    expect(
      buckets.map(({ id: bucketId, rows }) => [bucketId, rows?.length]),
    ).toEqual([
      ["test.outbox", undefined],
      ["test.inbox", 1],
    ]);
    expect(buckets[0].rows).toBeNull();
    expect(logger.error).toHaveBeenCalledWith(
      "Timeline: test.outbox could not be read (Error)",
    );
  });

  it("answers null rows for a bucket that does not declare the ref's kind", async () => {
    makeCollection();

    const { buckets } = await readTimeline("sbi:900000005");

    expect(buckets.map(({ rows }) => rows)).toEqual([null, null]);
  });
});

describe("readBucketTimeline", () => {
  beforeEach(() => {
    clearBuckets();
    registerBucket(
      testBucket({
        id: "test.inbox",
        label: "Test inbox",
        timeline: true,
        links: ["config"],
      }),
    );
    registerBucket(
      testBucket({ id: "test.outbox", label: "Test outbox", timeline: true }),
    );
  });

  afterEach(() => {
    clearBuckets();
  });

  it("reads the link in that bucket alone, 50 at most", async () => {
    const collection = makeCollection({ finds: [[doc(2), doc(1)]] });

    const { buckets } = await readBucketTimeline(
      "test.inbox",
      "config:woodland-creation",
    );

    expect(collection.find).toHaveBeenCalledExactlyOnceWith(
      { $and: [{ refs: "config:woodland-creation" }] },
      expect.objectContaining({ limit: 51 }),
    );
    expect(buckets).toEqual([
      {
        id: "test.inbox",
        label: "Test inbox",
        rows: [
          expect.objectContaining({ id: String(id(2)) }),
          expect.objectContaining({ id: String(id(1)) }),
        ],
        more: false,
      },
    ]);
    expect(timelineResponseSchema.validate({ buckets }).error).toBeUndefined();
  });

  it("says the bucket has more when its page has a next", async () => {
    makeCollection({
      finds: [Array.from({ length: 51 }, (_, n) => doc(60 - n))],
    });

    const { buckets } = await readBucketTimeline("test.inbox", "config:abc");

    expect(buckets.map(({ rows, more }) => [rows.length, more])).toEqual([
      [50, true],
    ]);
  });

  it("answers null rows when the bucket fails", async () => {
    const collection = makeCollection();

    collection.find.mockImplementationOnce(() => ({
      toArray: vi.fn(async () => {
        throw new Error("connection closed");
      }),
    }));

    const { buckets } = await readBucketTimeline("test.inbox", "config:abc");

    expect(buckets).toEqual([
      { id: "test.inbox", label: "Test inbox", rows: null, more: false },
    ]);
  });
});
