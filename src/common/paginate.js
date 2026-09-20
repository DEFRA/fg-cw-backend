import Boom from "@hapi/boom";
import { ObjectId } from "mongodb";

// A cursor is base64url JSON of each sort key's value and `_id`, from the
// cases list or from the actuator list's caller. Decoded values go straight
// into the query, so every codec asserts its type and rejects with a 400.

const HEX_ID = /^[0-9a-f]{24}$/i;

const assertString = (value, what) => {
  if (typeof value !== "string") {
    throw Boom.badRequest(`Cursor ${what} must be a string`);
  }

  return value;
};

/** A sort key stored as a string, compared as one: taken verbatim. */
export const stringCodec = {
  encode: (value) => value,
  decode: (value) => assertString(value, "value"),
};

/** A sort key stored as a BSON Date; a bound of any other type matches nothing. */
export const dateCodec = {
  encode: (value) => value?.toISOString(),
  decode: (value) => {
    const date = new Date(assertString(value, "date"));

    if (Number.isNaN(date.getTime())) {
      throw Boom.badRequest("Cursor date is not an instant");
    }

    return date;
  },
};

// `new ObjectId(undefined)` invents a fresh id rather than failing.
export const objectIdCodec = {
  encode: (value) => value.toHexString(),
  decode: (value) => {
    if (!HEX_ID.test(assertString(value, "id"))) {
      throw Boom.badRequest("Cursor id is not an object id");
    }

    return new ObjectId(value);
  },
};

const encodeCursor = (doc, sortKeys, codecs) => {
  const data = Object.fromEntries(
    sortKeys.map((key) => [key, codecs[key].encode(doc[key])]),
  );
  return Buffer.from(JSON.stringify(data)).toString("base64url");
};

// A missing key would reach a codec as undefined, so it is refused here.
const decodeKey = (data, key, codecs) => {
  if (!Object.hasOwn(data, key)) {
    throw Boom.badRequest(`Cursor is missing ${key}`);
  }

  return codecs[key].decode(data[key]);
};

const decodeCursor = (cursor, sortKeys, codecs) => {
  if (!cursor) {
    return null;
  }

  try {
    const data = JSON.parse(Buffer.from(cursor, "base64url").toString());

    return Object.fromEntries(
      sortKeys.map((key) => [key, decodeKey(data, key, codecs)]),
    );
  } catch {
    throw Boom.badRequest("Cannot decode cursor");
  }
};

const getPagingFilter = (cursor, sortEntries, isBackward) => {
  const op = (dir) => ((dir === 1) !== isBackward ? "$gt" : "$lt");

  return {
    $or: sortEntries.map((_, i) => ({
      ...Object.fromEntries(
        sortEntries.slice(0, i).map(([k]) => [k, cursor[k]]),
      ),
      [sortEntries[i][0]]: {
        [op(sortEntries[i][1])]: cursor[sortEntries[i][0]],
      },
    })),
  };
};

const invert = (sortEntries) =>
  Object.fromEntries(sortEntries.map(([k, v]) => [k, -v]));

const ensureTieBreaker = (sort) => {
  if (sort._id) {
    return sort;
  }

  return {
    ...sort,
    _id: Object.values(sort).at(-1),
  };
};

const countTotal = (collection, opts) =>
  opts.withTotal === false ? undefined : collection.countDocuments(opts.filter);

const withTotalCount = (pagination, totalCount) =>
  totalCount === undefined ? pagination : { ...pagination, totalCount };

// Redundant with the keyset `$or`, but it gives the planner an index range to
// walk: without it a selective filter could re-scan returned rows or sort in
// memory. Inclusive, and flipped when paging backward.
const leadingBound = (cursor, [key, dir], isBackward) => ({
  [key]: { [(dir === 1) !== isBackward ? "$gte" : "$lte"]: cursor[key] },
});

// Composed under `$and`, never spread: both the filter and the keyset can carry
// a top-level `$or`.
const withKeyset = (filter, cursor, sortEntries, isBackward) => {
  if (!cursor) {
    return filter;
  }

  return {
    $and: [
      filter ?? {},
      leadingBound(cursor, sortEntries[0], isBackward),
      getPagingFilter(cursor, sortEntries, isBackward),
    ],
  };
};

// Only a caller that sets a time limit passes find options at all.
const findArgs = (filter, maxTimeMS) =>
  maxTimeMS ? [filter, { maxTimeMS }] : [filter];

// eslint-disable-next-line complexity
export const paginate = async (collection, opts) => {
  const sort = ensureTieBreaker(opts.sort);
  const sortKeys = Object.keys(sort);
  const sortEntries = Object.entries(sort);
  const isBackward = opts.direction === "backward";
  const cursor = decodeCursor(opts.cursor, sortKeys, opts.codecs);

  const filter = withKeyset(opts.filter, cursor, sortEntries, isBackward);
  const effectiveSort = isBackward ? invert(sortEntries) : sort;

  const [docs, totalCount] = await Promise.all([
    collection
      .find(...findArgs(filter, opts.maxTimeMS))
      .project(opts.project)
      .sort(effectiveSort)
      .limit(opts.pageSize + 1)
      .toArray(),
    countTotal(collection, opts),
  ]);

  const hasMore = docs.length > opts.pageSize;

  if (hasMore) {
    docs.pop();
  }

  if (isBackward) {
    docs.reverse();
  }

  const isForward = !isBackward;
  const hasDocs = docs.length > 0;

  return {
    data: opts.mapDocument ? docs.map(opts.mapDocument) : docs,
    pagination: withTotalCount(
      {
        startCursor: hasDocs
          ? encodeCursor(docs.at(0), sortKeys, opts.codecs)
          : null,

        endCursor: hasDocs
          ? encodeCursor(docs.at(-1), sortKeys, opts.codecs)
          : null,

        hasNextPage: isForward ? hasMore : true,
        hasPreviousPage: isForward ? !!cursor : hasMore,
      },
      totalCount,
    ),
  };
};
