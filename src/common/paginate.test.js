import { describe, expect, it, vi } from "vitest";
import { dateCodec, objectIdCodec, paginate, stringCodec } from "./paginate.js";

const identity = {
  encode: (v) => v,
  decode: (v) => v,
};

const codecs = {
  name: identity,
  _id: identity,
};

const makeCursor = (obj) =>
  Buffer.from(JSON.stringify(obj)).toString("base64url");

const makeCollection = (docs, totalCount) => {
  const chain = {
    project: vi.fn().mockReturnThis(),
    sort: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    toArray: vi.fn().mockResolvedValue(docs),
  };
  return {
    find: vi.fn().mockReturnValue(chain),
    countDocuments: vi.fn().mockResolvedValue(totalCount),
    chain,
  };
};

describe("paginate", () => {
  const baseOpts = {
    filter: { active: true },
    sort: { name: 1 },
    codecs,
    cursor: undefined,
    direction: "forward",
    pageSize: 2,
    project: { name: 1 },
  };

  describe("first page (no cursor)", () => {
    it("returns data with pagination metadata", async () => {
      const docs = [
        { name: "Alice", _id: "1" },
        { name: "Bob", _id: "2" },
      ];
      const col = makeCollection(docs, 5);

      const result = await paginate(col, baseOpts);

      expect(result.data).toEqual(docs);
      expect(result.pagination.totalCount).toBe(5);
      expect(result.pagination.hasNextPage).toBe(false);
      expect(result.pagination.hasPreviousPage).toBe(false);
      expect(result.pagination.startCursor).toBe(
        makeCursor({ name: "Alice", _id: "1" }),
      );
      expect(result.pagination.endCursor).toBe(
        makeCursor({ name: "Bob", _id: "2" }),
      );
    });

    it("passes filter, project, sort and limit to collection", async () => {
      const col = makeCollection([], 0);

      await paginate(col, baseOpts);

      expect(col.find).toHaveBeenCalledWith({ active: true });
      expect(col.chain.project).toHaveBeenCalledWith({ name: 1 });
      expect(col.chain.sort).toHaveBeenCalledWith({ name: 1, _id: 1 });
      expect(col.chain.limit).toHaveBeenCalledWith(3);
      expect(col.countDocuments).toHaveBeenCalledWith({ active: true });
    });

    it("appends _id to sort using last sort direction", async () => {
      const col = makeCollection([], 0);

      await paginate(col, {
        ...baseOpts,
        sort: { createdAt: -1 },
        codecs: { createdAt: identity, _id: identity },
      });

      expect(col.chain.sort).toHaveBeenCalledWith({ createdAt: -1, _id: -1 });
    });

    it("does not append _id when sort already includes _id", async () => {
      const col = makeCollection([], 0);

      await paginate(col, {
        ...baseOpts,
        sort: { name: 1, _id: -1 },
        codecs: { name: identity, _id: identity },
      });

      expect(col.chain.sort).toHaveBeenCalledWith({ name: 1, _id: -1 });
    });
  });

  describe("forward pagination with cursor", () => {
    it("sets hasNextPage when there are more results", async () => {
      const docs = [
        { name: "Charlie", _id: "3" },
        { name: "Dave", _id: "4" },
        { name: "Eve", _id: "5" },
      ];
      const col = makeCollection(docs, 10);
      const cursor = makeCursor({ name: "Bob", _id: "2" });

      const result = await paginate(col, {
        ...baseOpts,
        cursor,
        direction: "forward",
      });

      expect(result.data).toHaveLength(2);
      expect(result.pagination.hasNextPage).toBe(true);
      expect(result.pagination.hasPreviousPage).toBe(true);
    });

    it("sets hasPreviousPage to true when cursor is present", async () => {
      const docs = [{ name: "Charlie", _id: "3" }];
      const col = makeCollection(docs, 10);
      const cursor = makeCursor({ name: "Bob", _id: "2" });

      const result = await paginate(col, {
        ...baseOpts,
        cursor,
        direction: "forward",
      });

      expect(result.pagination.hasPreviousPage).toBe(true);
      expect(result.pagination.hasNextPage).toBe(false);
    });

    it("builds paging filter for ascending sort", async () => {
      const col = makeCollection([], 0);
      const cursor = makeCursor({ name: "Bob", _id: "2" });

      await paginate(col, { ...baseOpts, cursor, direction: "forward" });

      expect(col.find).toHaveBeenCalledWith({
        $and: [
          { active: true },
          {
            $or: [{ name: { $gt: "Bob" } }, { name: "Bob", _id: { $gt: "2" } }],
          },
        ],
      });
    });

    it("builds paging filter for descending sort", async () => {
      const col = makeCollection([], 0);
      const cursor = makeCursor({ name: "Bob", _id: "2" });

      await paginate(col, {
        ...baseOpts,
        sort: { name: -1 },
        cursor,
        direction: "forward",
      });

      expect(col.find).toHaveBeenCalledWith({
        $and: [
          { active: true },
          {
            $or: [{ name: { $lt: "Bob" } }, { name: "Bob", _id: { $lt: "2" } }],
          },
        ],
      });
    });
  });

  describe("backward pagination", () => {
    it("reverses sort direction for query", async () => {
      const col = makeCollection([], 0);

      await paginate(col, { ...baseOpts, direction: "backward" });

      expect(col.chain.sort).toHaveBeenCalledWith({ name: -1, _id: -1 });
    });

    it("reverses docs back to original order", async () => {
      const docs = [
        { name: "Bob", _id: "2" },
        { name: "Alice", _id: "1" },
      ];
      const col = makeCollection(docs, 5);

      const result = await paginate(col, {
        ...baseOpts,
        direction: "backward",
      });

      expect(result.data).toEqual([
        { name: "Alice", _id: "1" },
        { name: "Bob", _id: "2" },
      ]);
    });

    it("sets hasNextPage to true and hasPreviousPage based on hasMore", async () => {
      const docs = [
        { name: "Charlie", _id: "3" },
        { name: "Bob", _id: "2" },
        { name: "Alice", _id: "1" },
      ];
      const col = makeCollection(docs, 10);
      const cursor = makeCursor({ name: "Dave", _id: "4" });

      const result = await paginate(col, {
        ...baseOpts,
        cursor,
        direction: "backward",
      });

      expect(result.pagination.hasNextPage).toBe(true);
      expect(result.pagination.hasPreviousPage).toBe(true);
    });

    it("sets hasPreviousPage to false when no more backward results", async () => {
      const docs = [
        { name: "Bob", _id: "2" },
        { name: "Alice", _id: "1" },
      ];
      const col = makeCollection(docs, 5);
      const cursor = makeCursor({ name: "Charlie", _id: "3" });

      const result = await paginate(col, {
        ...baseOpts,
        cursor,
        direction: "backward",
      });

      expect(result.pagination.hasPreviousPage).toBe(false);
    });

    it("builds paging filter with reversed operators", async () => {
      const col = makeCollection([], 0);
      const cursor = makeCursor({ name: "Charlie", _id: "3" });

      await paginate(col, {
        ...baseOpts,
        cursor,
        direction: "backward",
      });

      expect(col.find).toHaveBeenCalledWith({
        $and: [
          { active: true },
          {
            $or: [
              { name: { $lt: "Charlie" } },
              { name: "Charlie", _id: { $lt: "3" } },
            ],
          },
        ],
      });
    });
  });

  describe("empty results", () => {
    it("returns null cursors and false for page flags", async () => {
      const col = makeCollection([], 0);

      const result = await paginate(col, baseOpts);

      expect(result.data).toEqual([]);
      expect(result.pagination.startCursor).toBeNull();
      expect(result.pagination.endCursor).toBeNull();
      expect(result.pagination.hasNextPage).toBe(false);
      expect(result.pagination.hasPreviousPage).toBe(false);
      expect(result.pagination.totalCount).toBe(0);
    });
  });

  // A cursor is this service's own value handed back by a caller, so it
  // arrives as attacker-controlled JSON and every decoded value goes straight
  // into query position. These pin that a tampered one is refused rather than
  // asked.
  describe("cursor decoding", () => {
    const strictCodecs = { name: stringCodec, _id: objectIdCodec };
    const ID = "665f1c2e9a1b2c3d4e5f6a7b";

    const decoding = (cursor, codecOverrides = {}) =>
      paginate(makeCollection([], 0), {
        ...baseOpts,
        codecs: { ...strictCodecs, ...codecOverrides },
        cursor,
      });

    it("throws Boom.badRequest for invalid cursor", async () => {
      await expect(decoding("not-valid-base64!")).rejects.toThrow(
        "Cannot decode cursor",
      );
    });

    it("takes a cursor it wrote itself", async () => {
      await expect(
        decoding(makeCursor({ name: "Bob", _id: ID })),
      ).resolves.toBeDefined();
    });

    // Valid JSON, valid base64, and a Mongo operator where a value belongs:
    // spread into query position this is an attacker choosing the predicate.
    it("refuses an operator object smuggled in where a value belongs", async () => {
      const tampered = makeCursor({ name: { $gt: "" }, _id: ID });

      await expect(decoding(tampered)).rejects.toMatchObject({
        output: { statusCode: 400 },
      });
    });

    // `new ObjectId(undefined)` FABRICATES an id rather than throwing, so this
    // used to page from an invented position and answer, confidently, with the
    // wrong rows.
    it("refuses a cursor with no id rather than inventing one", async () => {
      await expect(decoding(makeCursor({ name: "Bob" }))).rejects.toMatchObject(
        { output: { statusCode: 400 } },
      );
    });

    it.each([
      ["an id that is not hex", "not-an-object-id"],
      ["an id of the wrong length", "665f1c2e"],
      ["an id that is not a string", 12345],
    ])("refuses %s", async (_name, id) => {
      await expect(
        decoding(makeCursor({ name: "Bob", _id: id })),
      ).rejects.toMatchObject({ output: { statusCode: 400 } });
    });

    it("refuses a sort value of the wrong type", async () => {
      await expect(
        decoding(makeCursor({ name: 42, _id: ID })),
      ).rejects.toMatchObject({ output: { statusCode: 400 } });
    });

    it("refuses a date that is not an instant", async () => {
      await expect(
        decoding(makeCursor({ name: "not-a-date", _id: ID }), {
          name: dateCodec,
        }),
      ).rejects.toMatchObject({ output: { statusCode: 400 } });
    });

    it("takes a date it wrote itself", async () => {
      await expect(
        decoding(makeCursor({ name: "2026-06-16T10:00:00.000Z", _id: ID }), {
          name: dateCodec,
        }),
      ).resolves.toBeDefined();
    });
  });

  describe("mapDocument", () => {
    it("applies mapDocument to results", async () => {
      const docs = [
        { name: "Alice", _id: "1" },
        { name: "Bob", _id: "2" },
      ];
      const col = makeCollection(docs, 2);

      const result = await paginate(col, {
        ...baseOpts,
        mapDocument: (doc) => ({ label: doc.name }),
      });

      expect(result.data).toEqual([{ label: "Alice" }, { label: "Bob" }]);
    });

    it("cursors are based on original docs not mapped data", async () => {
      const docs = [{ name: "Alice", _id: "1" }];
      const col = makeCollection(docs, 1);

      const result = await paginate(col, {
        ...baseOpts,
        mapDocument: () => ({ transformed: true }),
      });

      expect(result.pagination.startCursor).toBe(
        makeCursor({ name: "Alice", _id: "1" }),
      );
    });
  });

  describe("codecs", () => {
    it("encodes and decodes cursor values using codecs", async () => {
      const dateCodecs = {
        createdAt: {
          encode: (v) => v.toISOString(),
          decode: (v) => new Date(v),
        },
        _id: identity,
      };
      const date = new Date("2025-01-15T10:00:00Z");
      const docs = [{ createdAt: date, _id: "1" }];
      const col = makeCollection(docs, 1);

      const result = await paginate(col, {
        ...baseOpts,
        sort: { createdAt: -1 },
        codecs: dateCodecs,
      });

      expect(result.pagination.startCursor).toBe(
        makeCursor({ createdAt: "2025-01-15T10:00:00.000Z", _id: "1" }),
      );
    });

    it("decodes cursor before building filter", async () => {
      const dateCodecs = {
        createdAt: {
          encode: (v) => v.toISOString(),
          decode: (v) => new Date(v),
        },
        _id: identity,
      };
      const col = makeCollection([], 0);
      const cursor = makeCursor({
        createdAt: "2025-01-15T10:00:00.000Z",
        _id: "1",
      });

      await paginate(col, {
        ...baseOpts,
        sort: { createdAt: -1 },
        codecs: dateCodecs,
        cursor,
        direction: "forward",
      });

      const [, keyset] = col.find.mock.calls[0][0].$and;

      expect(keyset.$or[0].createdAt.$lt).toEqual(
        new Date("2025-01-15T10:00:00.000Z"),
      );
    });

    // Both halves of the filter can carry a top-level `$or` - the keyset
    // always does, and a `?q=` search does whenever it is the only clause -
    // so they are composed rather than spread together. Spread, the position
    // replaced the search and page two answered with unfiltered rows.
    it("keeps a filter that has an $or of its own", async () => {
      const col = makeCollection([], 0);
      const search = { $or: [{ name: "Bob" }, { alias: "Bob" }] };

      await paginate(col, {
        ...baseOpts,
        filter: search,
        cursor: makeCursor({ name: "Bob", _id: "2" }),
        direction: "forward",
      });

      const [filter, keyset] = col.find.mock.calls[0][0].$and;

      expect(filter).toEqual(search);
      expect(keyset.$or).toHaveLength(2);
    });
  });

  describe("withTotal", () => {
    it("omits totalCount and does not count when withTotal is false", async () => {
      const col = makeCollection([{ name: "Alice", _id: "1" }], 5);

      const result = await paginate(col, { ...baseOpts, withTotal: false });

      expect(col.countDocuments).not.toHaveBeenCalled();
      expect(result.pagination).not.toHaveProperty("totalCount");
    });

    it("still counts when withTotal is omitted", async () => {
      const col = makeCollection([{ name: "Alice", _id: "1" }], 5);

      const result = await paginate(col, baseOpts);

      expect(col.countDocuments).toHaveBeenCalledWith(baseOpts.filter);
      expect(result.pagination.totalCount).toBe(5);
    });

    it("still counts when withTotal is true", async () => {
      const col = makeCollection([{ name: "Alice", _id: "1" }], 5);

      const result = await paginate(col, { ...baseOpts, withTotal: true });

      expect(col.countDocuments).toHaveBeenCalledWith(baseOpts.filter);
      expect(result.pagination.totalCount).toBe(5);
    });

    it("returns totalCount 0 without treating it as absent", async () => {
      const col = makeCollection([], 0);

      const result = await paginate(col, baseOpts);

      expect(result.pagination).toHaveProperty("totalCount", 0);
    });

    it("keeps the rest of the pagination envelope when withTotal is false", async () => {
      const docs = [
        { name: "Alice", _id: "1" },
        { name: "Bob", _id: "2" },
      ];
      const col = makeCollection(docs, 5);

      const result = await paginate(col, { ...baseOpts, withTotal: false });

      expect(result.pagination).toEqual({
        startCursor: makeCursor({ name: "Alice", _id: "1" }),
        endCursor: makeCursor({ name: "Bob", _id: "2" }),
        hasNextPage: false,
        hasPreviousPage: false,
      });
    });
  });
});
