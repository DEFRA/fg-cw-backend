import { setTimeout } from "node:timers/promises";
import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { logger } from "../logger.js";
import { db } from "../mongo-client.js";
import { findCurrentSearches } from "./current-searches.js";
import { declarationOf } from "./declarations.js";
import { ensureSearchIndexes } from "./document.js";
import { SearchReindexer } from "./reindexer.js";
import {
  countSearchMatches,
  findStaleIds,
  indexRecord,
  readSearchPage,
  rebuildSearchDocuments,
  sweepRecords,
  warnLeftOut,
} from "./store.js";

vi.mock("node:timers/promises");
vi.mock("../logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("../mongo-client.js", () => ({
  db: { collection: vi.fn() },
  mongoClient: {},
}));
vi.mock("../with-transaction.js", () => ({
  withTransaction: (work) => work("a-session"),
}));

const id = (n) =>
  ObjectId.createFromHexString(n.toString(16).padStart(24, "0"));

const createdAt = new Date("2026-03-04T05:06:07Z");

const nameSearch = {
  fields: [
    { key: "name", label: "Name", path: "$.answers.name", match: "prefix" },
  ],
};

const declared = declarationOf(nameSearch, 2);
const later = declarationOf(nameSearch, 3);

const source = {
  collection: "record_search",
  records: "records",
  lead: "code",
  projection: { answers: 1 },
  viewOf: (record) => ({ answers: record.answers }),
  declarations: { forValue: vi.fn(), current: vi.fn() },
};

const recordOf = (n, name = "Meadow Farm") => ({
  _id: id(n),
  code: "grant-a",
  createdAt,
  answers: { name },
});

const documentOf = (n, declaration = declared, keys = ["name:meadowfarm"]) => ({
  _id: id(n),
  code: "grant-a",
  createdAt,
  keys,
  sig: declaration.sig,
  stamp: declaration.stamp,
});

const cursorOf = (docs) => ({ toArray: vi.fn().mockResolvedValue(docs) });

let records;
let searches;

beforeEach(() => {
  records = { find: vi.fn() };
  searches = {
    find: vi.fn(),
    findOne: vi.fn(),
    replaceOne: vi.fn().mockResolvedValue({ matchedCount: 1 }),
    updateOne: vi.fn().mockResolvedValue({ matchedCount: 1 }),
    bulkWrite: vi.fn(),
    countDocuments: vi.fn(),
    createIndex: vi.fn(),
  };
  db.collection.mockImplementation((name) =>
    name === "records" ? records : searches,
  );
});

describe("ensureSearchIndexes", () => {
  it("builds the search and the reindexer's index", async () => {
    await ensureSearchIndexes(db, source);

    expect(searches.createIndex.mock.calls).toEqual([
      [{ code: 1, keys: 1, createdAt: -1, _id: -1 }],
      [{ code: 1, sig: 1, stamp: 1 }],
    ]);
  });
});

describe("warnLeftOut", () => {
  it("warns with counts and keys of what it left out", () => {
    warnLeftOut(source, { name: { unsupported: 1, overCap: 2 } }, 3);

    expect(logger.warn).toHaveBeenCalledWith(
      "Search record_search: values not indexed on 3 records: name (1 not text, 2 over the caps)",
    );
  });

  it("is silent when nothing was left out", () => {
    warnLeftOut(source, {});

    expect(logger.warn).not.toHaveBeenCalled();
  });
});

describe("indexRecord", () => {
  it("creates the document of a record that has none", async () => {
    searches.findOne.mockResolvedValue(null);
    source.declarations.forValue.mockResolvedValue(declared);

    await indexRecord(source, recordOf(1), "a-session");

    expect(searches.findOne).toHaveBeenCalledWith(
      { _id: id(1) },
      { projection: { _id: 0, stamp: 1 }, session: "a-session" },
    );
    expect(searches.replaceOne).toHaveBeenCalledWith(
      { _id: id(1) },
      documentOf(1),
      { upsert: true, session: "a-session" },
    );
  });

  it("replaces a stored document unless a later declaration built it meanwhile", async () => {
    searches.findOne.mockResolvedValue({ stamp: declared.stamp });
    source.declarations.forValue.mockResolvedValue(declared);

    await indexRecord(source, recordOf(1));

    expect(searches.replaceOne).toHaveBeenCalledWith(
      { _id: id(1), stamp: { $not: { $gt: declared.stamp } } },
      documentOf(1),
      { upsert: false, session: undefined },
    );
    expect(searches.updateOne).not.toHaveBeenCalled();
  });

  it("reads the declarations afresh before it gives up on a document built from a later one", async () => {
    searches.findOne.mockResolvedValue({ stamp: later.stamp });
    source.declarations.forValue
      .mockResolvedValueOnce(declared)
      .mockResolvedValueOnce(later);

    await indexRecord(source, recordOf(1));

    expect(source.declarations.forValue.mock.calls).toEqual([
      ["grant-a"],
      ["grant-a", { fresh: true }],
    ]);
    expect(searches.replaceOne).toHaveBeenCalledWith(
      { _id: id(1), stamp: { $not: { $gt: later.stamp } } },
      documentOf(1, later),
      { upsert: false, session: undefined },
    );
  });

  it("marks out of date a document built from a later declaration than it holds", async () => {
    searches.findOne.mockResolvedValue({ stamp: later.stamp });
    source.declarations.forValue.mockResolvedValue(declared);

    await indexRecord(source, recordOf(1), "a-session");

    expect(searches.replaceOne).not.toHaveBeenCalled();
    expect(searches.updateOne).toHaveBeenCalledWith(
      { _id: id(1), stamp: later.stamp },
      { $set: { sig: null } },
      { session: "a-session" },
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("leaves to the sweep a document that changed while it was marked", async () => {
    searches.findOne.mockResolvedValue({ stamp: later.stamp });
    searches.updateOne.mockResolvedValue({ matchedCount: 0 });
    source.declarations.forValue.mockResolvedValue(declared);

    await indexRecord(source, recordOf(1));

    expect(logger.warn).toHaveBeenCalledWith(
      `Search record_search: document ${id(1)} changed while written, left to the sweep`,
    );
  });

  it("marks out of date a document a later declaration rebuilt between its read and its replace", async () => {
    searches.findOne.mockResolvedValue({ stamp: declared.stamp });
    searches.replaceOne.mockResolvedValue({ matchedCount: 0 });
    source.declarations.forValue.mockResolvedValue(declared);

    await indexRecord(source, recordOf(1));

    expect(searches.updateOne).toHaveBeenCalledWith(
      { _id: id(1) },
      { $set: { sig: null } },
      { session: undefined },
    );
  });

  it("warns of a value it could not index", async () => {
    searches.findOne.mockResolvedValue(null);
    source.declarations.forValue.mockResolvedValue(declared);

    await indexRecord(source, recordOf(1, { first: "Meadow" }));

    expect(searches.replaceOne).toHaveBeenCalledWith(
      { _id: id(1) },
      documentOf(1, declared, []),
      { upsert: true, session: undefined },
    );
    expect(logger.warn).toHaveBeenCalledWith(
      "Search record_search: values not indexed on 1 records: name (1 not text, 0 over the caps)",
    );
  });
});

describe("readSearchPage", () => {
  it("finds an exact value, newest first, within the lead value", async () => {
    searches.find.mockReturnValue(cursorOf([{ _id: id(1), createdAt }]));

    const hits = await readSearchPage(source, {
      value: "grant-a",
      field: { key: "ref", match: "exact", value: "ab12" },
      limit: 21,
      maxTimeMS: 900,
    });

    expect(hits).toEqual([{ _id: id(1), createdAt }]);
    expect(searches.find).toHaveBeenCalledWith(
      { $and: [{ code: "grant-a", keys: "ref:ab12" }] },
      {
        projection: { _id: 1, createdAt: 1 },
        sort: { createdAt: -1, _id: -1 },
        limit: 21,
        maxTimeMS: 900,
      },
    );
  });

  it("finds a prefix as text, after a position and within a range", async () => {
    searches.find.mockReturnValue(cursorOf([]));
    const range = { $gte: createdAt };

    await readSearchPage(source, {
      value: "grant-a",
      field: { key: "name", match: "prefix", value: "a.b" },
      range,
      after: { t: createdAt, i: id(2) },
      limit: 21,
      maxTimeMS: 900,
    });

    expect(searches.find.mock.calls[0][0]).toEqual({
      $and: [
        { code: "grant-a", keys: { $regex: String.raw`^name:a\.b` } },
        { createdAt: range },
        { createdAt: { $lte: createdAt } },
        { $nor: [{ createdAt, _id: { $gte: id(2) } }] },
      ],
    });
  });
});

describe("countSearchMatches", () => {
  it("counts what a first page matches, up to the limit", async () => {
    searches.countDocuments.mockResolvedValue(4);

    const found = await countSearchMatches(source, {
      value: "grant-a",
      field: { key: "ref", match: "exact", value: "ab12" },
      range: {},
      limit: 10_001,
      maxTimeMS: 900,
    });

    expect(found).toBe(4);
    expect(searches.countDocuments).toHaveBeenCalledWith(
      { $and: [{ code: "grant-a", keys: "ref:ab12" }] },
      { limit: 10_001, maxTimeMS: 900 },
    );
  });
});

describe("findStaleIds", () => {
  it("finds the documents of a value built from another declaration, none from a later one", async () => {
    searches.find.mockReturnValue(cursorOf([{ _id: id(1) }, { _id: id(2) }]));

    const ids = await findStaleIds(source, "grant-a", declared, 200);

    expect(ids).toEqual([id(1), id(2)]);
    expect(searches.find).toHaveBeenCalledWith(
      {
        code: "grant-a",
        sig: { $ne: declared.sig },
        stamp: { $not: { $gt: declared.stamp } },
      },
      { projection: { _id: 1 }, limit: 200, readPreference: "primary" },
    );
  });
});

describe("rebuildSearchDocuments", () => {
  it("rebuilds the documents of records found and removes those of records gone", async () => {
    records.find.mockReturnValue(cursorOf([recordOf(1)]));
    searches.bulkWrite.mockResolvedValue({ matchedCount: 1, deletedCount: 1 });

    const { built, rebuilt, removed } = await rebuildSearchDocuments(
      source,
      [id(1), id(2)],
      declared,
      "a-session",
    );

    expect(records.find).toHaveBeenCalledWith(
      { _id: { $in: [id(1), id(2)] } },
      {
        projection: { code: 1, createdAt: 1, answers: 1 },
        session: "a-session",
      },
    );
    expect(searches.bulkWrite).toHaveBeenCalledWith(
      [
        {
          replaceOne: {
            filter: { _id: id(1), stamp: { $not: { $gt: declared.stamp } } },
            replacement: documentOf(1),
          },
        },
        { deleteOne: { filter: { _id: id(2) } } },
      ],
      { session: "a-session", ordered: false },
    );
    expect(built).toEqual([{ document: documentOf(1), left: {} }]);
    expect({ rebuilt, removed }).toEqual({ rebuilt: 1, removed: 1 });
  });
});

describe("sweepRecords", () => {
  const declarations = new Map([["grant-a", declared]]);

  it("replaces missing and different documents and removes those of records gone", async () => {
    const undeclared = { ...recordOf(4), code: "grant-b" };

    records.find.mockReturnValue(
      cursorOf([
        recordOf(1),
        recordOf(2),
        recordOf(3),
        undeclared,
        recordOf(6),
      ]),
    );
    searches.find.mockReturnValue(
      cursorOf([
        documentOf(1),
        documentOf(2, declared, ["name:old"]),
        documentOf(5),
        documentOf(6, later),
      ]),
    );

    const swept = await sweepRecords(
      source,
      declarations,
      { after: id(0), limit: 5 },
      "a-session",
    );

    expect(records.find).toHaveBeenCalledWith(
      { _id: { $gt: id(0) } },
      {
        projection: { code: 1, createdAt: 1, answers: 1 },
        sort: { _id: 1 },
        limit: 5,
        session: "a-session",
      },
    );
    expect(searches.find).toHaveBeenCalledWith(
      { _id: { $gt: id(0), $lte: id(6) } },
      { session: "a-session" },
    );
    expect(searches.bulkWrite).toHaveBeenCalledWith(
      [
        {
          replaceOne: {
            filter: { _id: id(2) },
            replacement: documentOf(2),
            upsert: true,
          },
        },
        {
          replaceOne: {
            filter: { _id: id(3) },
            replacement: documentOf(3),
            upsert: true,
          },
        },
        { deleteOne: { filter: { _id: id(5) } } },
      ],
      { session: "a-session", ordered: false },
    );
    expect(swept).toEqual({
      checked: 5,
      changed: [
        { document: documentOf(2), left: {} },
        { document: documentOf(3), left: {} },
      ],
      removed: 1,
      last: id(6),
    });
  });

  it("writes nothing when every document is current, and runs to the end once the records end", async () => {
    records.find.mockReturnValue(cursorOf([recordOf(1)]));
    searches.find.mockReturnValue(cursorOf([documentOf(1)]));

    const swept = await sweepRecords(source, declarations, {
      after: null,
      limit: 5,
    });

    expect(searches.find).toHaveBeenCalledWith({}, { session: undefined });
    expect(searches.bulkWrite).not.toHaveBeenCalled();
    expect(swept).toEqual({ checked: 1, changed: [], removed: 0, last: null });
  });
});

describe("findCurrentSearches", () => {
  it("answers nothing without config versions", async () => {
    const database = {
      collection: vi.fn().mockReturnValue({
        find: vi.fn().mockReturnValue(cursorOf([])),
        aggregate: vi.fn().mockReturnValue(cursorOf([])),
      }),
    };

    expect(await findCurrentSearches(database, "definitions")).toEqual([]);
  });
});

describe("SearchReindexer", () => {
  let reindexer;

  const runWake = async () => {
    setTimeout.mockImplementation(async (ms) => {
      if (ms === 30_000) {
        reindexer.stop();
      }
    });

    reindexer.start();

    await vi.waitFor(() =>
      expect(logger.info).toHaveBeenCalledWith(
        "Stopping search reindexer for record_search",
      ),
    );
  };

  beforeEach(() => {
    reindexer = new SearchReindexer({ source, intervalMs: 30_000 });
    searches.bulkWrite.mockResolvedValue({ matchedCount: 1, deletedCount: 0 });
  });

  it("rebuilds stale documents in batches until none are left, pausing between them", async () => {
    source.declarations.current.mockResolvedValue(
      new Map([["grant-a", declared]]),
    );
    searches.find
      .mockReturnValueOnce(cursorOf([{ _id: id(1) }]))
      .mockReturnValueOnce(cursorOf([]));
    records.find.mockReturnValue(cursorOf([recordOf(1)]));

    await runWake();

    expect(setTimeout).toHaveBeenCalledWith(250, undefined, { ref: false });
    expect(searches.bulkWrite).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(
      "Search record_search: rebuilt 1 and removed 0 documents of grant-a",
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("warns of the values a rebuild left out", async () => {
    source.declarations.current.mockResolvedValue(
      new Map([["grant-a", declared]]),
    );
    searches.find
      .mockReturnValueOnce(cursorOf([{ _id: id(1) }]))
      .mockReturnValueOnce(cursorOf([]));
    records.find.mockReturnValue(cursorOf([recordOf(1, { first: "Meadow" })]));

    await runWake();

    expect(logger.warn).toHaveBeenCalledWith(
      "Search record_search: values not indexed on 1 records: name (1 not text, 0 over the caps)",
    );
  });

  it("ends a wake when its declaration changes between batches", async () => {
    source.declarations.current
      .mockResolvedValueOnce(
        new Map([
          ["grant-a", declared],
          ["grant-b", declared],
        ]),
      )
      .mockResolvedValue(new Map([["grant-a", later]]));
    searches.find.mockReturnValue(cursorOf([{ _id: id(1) }]));
    records.find.mockReturnValue(cursorOf([recordOf(1)]));

    await runWake();

    expect(searches.find).toHaveBeenCalledTimes(1);
    expect(searches.bulkWrite).toHaveBeenCalledTimes(1);
  });

  it("rebuilds at most ten batches a wake, leaving the rest to the next", async () => {
    source.declarations.current.mockResolvedValue(
      new Map([
        ["grant-a", declared],
        ["grant-b", declared],
      ]),
    );
    searches.find.mockReturnValue(cursorOf([{ _id: id(1) }]));
    records.find.mockReturnValue(cursorOf([recordOf(1)]));

    await runWake();

    expect(searches.bulkWrite).toHaveBeenCalledTimes(10);
    expect(logger.info).toHaveBeenCalledWith(
      "Search record_search: rebuilt 10 and removed 0 documents of grant-a",
    );
  });

  it("logs a reindexer that stops on an error outside a pass", async () => {
    const error = new Error("timer failed");

    source.declarations.current.mockResolvedValue(new Map());
    setTimeout.mockRejectedValue(error);

    reindexer.start();

    await vi.waitFor(() =>
      expect(logger.error).toHaveBeenCalledWith(
        error,
        "Search reindexer stopped",
      ),
    );
  });
});
