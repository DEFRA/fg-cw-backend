import Boom from "@hapi/boom";
import { ObjectId } from "mongodb";

// The cursor codecs every paged collection shares.
//
// A cursor is a value this service wrote, base64'd, and handed to a caller
// that hands it back - so it arrives as attacker-controlled JSON, and each
// decoded value goes straight into query position in `getPagingFilter`. A
// codec that took whatever it was given would let a tampered cursor put an
// operator object there (`{"eventTime":{"$gt":""}}` is valid JSON and a valid
// Mongo predicate), which is why every decode below asserts its own type
// rather than trusting the shape. A rejection here surfaces as the 400 the
// route already answers a garbled cursor with.

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

/**
 * The tie-breaker every page ends with.
 *
 * The hex assertion is the load-bearing one: `new ObjectId(undefined)`
 * FABRICATES a fresh id rather than failing, so a cursor with the key missing
 * or the value wrong used to page from an invented position and answer with a
 * confidently wrong page.
 */
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

// A key the payload does not carry is a cursor this service did not write.
// It matters because an absent value is exactly what the codecs used to be
// handed on the way to fabricating a position out of nothing.
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

// The page's position, COMPOSED with its filter under `$and` and never spread
// together. Both halves can carry a top-level `$or` - the keyset always does,
// and a `?q=` search does whenever it is the only clause - and spreading them
// let the position silently replace the search, so page two of a search
// answered with unfiltered rows.
const withKeyset = (filter, cursor, sortEntries, isBackward) => {
  if (!cursor) {
    return filter;
  }

  return {
    $and: [filter ?? {}, getPagingFilter(cursor, sortEntries, isBackward)],
  };
};

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
      .find(filter)
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
