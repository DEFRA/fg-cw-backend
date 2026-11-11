import { caseViewOf } from "../src/cases/search/case-view.js";
import { logger } from "../src/common/logger.js";
import { findCurrentSearches } from "../src/common/search/current-searches.js";
import {
  NO_DECLARATION,
  declarationOf,
} from "../src/common/search/declarations.js";
import {
  ensureSearchIndexes,
  searchDocumentOf,
} from "../src/common/search/document.js";
import { addLeftOut, describeLeftOut } from "../src/common/search/keys.js";

// Gives every case its search document, built from its workflow's current
// declaration as the writers and the reindexer build it. Each document is
// replaced whole, so it is safe to run over one a writer has already written.
// An instance of the release before keeps inserting cases meanwhile; the sweep
// gives those theirs.

const BATCH_SIZE = 1000;

const primary = { readPreference: "primary" };

const search = {
  collection: "case_search",
  lead: "workflowCode",
  viewOf: caseViewOf,
};

const readDeclarations = async (db) =>
  new Map(
    (await findCurrentSearches(db, "workflows")).map(
      ({ value, search: declared, change }) => [
        value,
        declarationOf(declared, change),
      ],
    ),
  );

const toWrite = ({ document }) => ({
  replaceOne: {
    filter: { _id: document._id },
    replacement: document,
    upsert: true,
  },
});

const writeAll = async (db, declarations) => {
  const all = db.collection("cases").find(
    {},
    {
      ...primary,
      projection: {
        workflowCode: 1,
        createdAt: 1,
        payload: 1,
        supplementaryData: 1,
      },
      sort: { _id: 1 },
      batchSize: BATCH_SIZE,
    },
  );
  const totals = { written: 0, withoutKeys: 0, left: {}, leftOn: 0 };
  let writes = [];

  const flush = async () => {
    await db
      .collection(search.collection)
      .bulkWrite(writes, { ordered: false });
    totals.written += writes.length;
    writes = [];
  };

  for await (const kase of all) {
    const declaration = declarations.get(kase.workflowCode) ?? NO_DECLARATION;
    const built = searchDocumentOf(search, kase, declaration);

    totals.withoutKeys += Number(built.document.keys.length === 0);
    totals.leftOn += Number(Object.keys(built.left).length > 0);
    totals.left = addLeftOut(totals.left, built.left);
    writes.push(toWrite(built));

    if (writes.length === BATCH_SIZE) {
      await flush();
    }
  }

  if (writes.length > 0) {
    await flush();
  }

  return totals;
};

const countAll = async (db) => {
  const [cases, documents] = await Promise.all([
    db.collection("cases").countDocuments({}, primary),
    db.collection(search.collection).countDocuments({}, primary),
  ]);

  return { cases, documents };
};

export const up = async (db) => {
  await ensureSearchIndexes(db, search);

  const declarations = await readDeclarations(db);
  const { written, withoutKeys, left, leftOn } = await writeAll(
    db,
    declarations,
  );

  logger.info(
    `Gave ${written} cases their search documents, ${withoutKeys} of them with no keys`,
  );

  if (leftOn > 0) {
    logger.warn(
      `Search ${search.collection}: values not indexed on ${leftOn} records: ${describeLeftOut(left)}`,
    );
  }

  const { cases, documents } = await countAll(db);

  logger.info(
    `Search ${search.collection}: ${documents} documents for ${cases} cases`,
  );
};
