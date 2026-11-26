import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Inbox } from "../cases/models/inbox.js";
import { Outbox } from "../cases/models/outbox.js";
import {
  claimEvents as claimInbox,
  updateDeadEvents as deadInbox,
  updateFailedEvents as failedInbox,
  redriveById as redriveInbox,
  updateResubmittedEvents as resubmittedInbox,
} from "../cases/repositories/inbox.repository.js";
import {
  claimEvents as claimOutbox,
  updateDeadEvents as deadOutbox,
  updateFailedEvents as failedOutbox,
  redriveById as redriveOutbox,
  updateResubmittedEvents as resubmittedOutbox,
} from "../cases/repositories/outbox.repository.js";
import {
  DEAD_LETTER,
  REDRIVABLE_STATUSES,
  redriveConflict,
} from "./event-redrive.js";
import { anAttemptHistory } from "../../test/fixtures/attempt-history.js";
import { db } from "../common/mongo-client.js";

vi.mock("../common/mongo-client.js");

const MAX_RETRIES = 5;
const ID = "665f1c2e9a1b2c3d4e5f6a7b";
const SEGREGATION_REF = "GLD-9B2";

// A minimal Mongo, so the repositories' real filters and updates run against
// a redriven document.
const OPERATORS = {
  $eq: (value, operand) => value === operand,
  $ne: (value, operand) => value !== operand,
  $lt: (value, operand) => value < operand,
  $lte: (value, operand) => value <= operand,
  $gte: (value, operand) => value >= operand,
  $in: (value, operand) => operand.includes(value),
  $nin: (value, operand) => !operand.includes(value),
};

const isOperatorObject = (condition) =>
  condition !== null &&
  typeof condition === "object" &&
  Object.keys(condition).length > 0 &&
  Object.keys(condition).every((key) => key in OPERATORS);

const matchesCondition = (value, condition) =>
  isOperatorObject(condition)
    ? Object.entries(condition).every(([operator, operand]) =>
        OPERATORS[operator](value, operand),
      )
    : value === condition;

// `_id` is dropped: ObjectIds compare by identity.
const matchesFilter = (doc, filter) => {
  const { _id, ...rest } = filter;

  return Object.entries(rest).every(([key, condition]) =>
    matchesCondition(doc[key], condition),
  );
};

const applyInc = (doc, increments) => {
  const result = { ...doc };

  for (const [key, delta] of Object.entries(increments ?? {})) {
    result[key] = (result[key] ?? 0) + delta;
  }

  return result;
};

const EXPRESSIONS = {
  $literal: (_, value) => value,
  $eq: (doc, [a, b]) => evaluate(doc, a) === evaluate(doc, b),
  $ne: (doc, [a, b]) => evaluate(doc, a) !== evaluate(doc, b),
  $gt: (doc, [a, b]) => evaluate(doc, a) > evaluate(doc, b),
  $size: (doc, value) => evaluate(doc, value).length,
  $let: (doc, { vars, in: body }) =>
    evaluate({ ...doc, ...evaluateFields(doc, vars) }, body),
  $sortArray: (doc, { input, sortBy }) => {
    const [[key]] = Object.entries(sortBy);

    return evaluate(doc, input).toSorted((a, b) =>
      a[key] < b[key] ? -1 : Number(a[key] > b[key]),
    );
  },
  $and: (doc, values) => values.every((value) => evaluate(doc, value)),
  $not: (doc, [value]) => !evaluate(doc, value),
  $in: (doc, [value, array]) =>
    evaluate(doc, array).includes(evaluate(doc, value)),
  $anyElementTrue: (doc, [array]) => evaluate(doc, array).some(Boolean),
  $map: (doc, { input, in: each }) =>
    evaluate(doc, input).map((element) =>
      evaluate({ ...doc, this: element }, each),
    ),
  $cond: (doc, [test, then, otherwise]) =>
    evaluate(doc, evaluate(doc, test) ? then : otherwise),
  $ifNull: (doc, [value, fallback]) =>
    evaluate(doc, value) ?? evaluate(doc, fallback),
  $add: (doc, values) =>
    values.reduce((sum, value) => sum + evaluate(doc, value), 0),
  $concatArrays: (doc, arrays) =>
    arrays.flatMap((array) => evaluate(doc, array)),
};

const isFieldPath = (expression) =>
  typeof expression === "string" && expression.startsWith("$");

const operatorOf = (expression) =>
  Object.keys(expression ?? {}).find((key) => key in EXPRESSIONS);

const isMissing = (value) => value === undefined || value === null;

// A path through an array reads that field of each element, as Mongo's does.
const valueAt = (value, [key, ...rest]) => {
  if (key === undefined || isMissing(value)) {
    return value;
  }

  return Array.isArray(value)
    ? value.map((element) => valueAt(element, [key, ...rest]))
    : valueAt(value[key], rest);
};

const isObject = (value) =>
  value !== null && typeof value === "object" && !(value instanceof Date);

const evaluateFields = (doc, expression) =>
  Object.fromEntries(
    Object.entries(expression)
      .map(([key, value]) => [key, evaluate(doc, value)])
      .filter(([, value]) => value !== undefined),
  );

const evaluateValue = (doc, expression) => {
  if (Array.isArray(expression)) {
    return expression.map((element) => evaluate(doc, element));
  }

  return isObject(expression) ? evaluateFields(doc, expression) : expression;
};

// The few aggregation expressions an update pipeline here uses.
const evaluate = (doc, expression) => {
  if (isFieldPath(expression)) {
    return valueAt(doc, expression.replace(/^\$\$?/, "").split("."));
  }

  const operator = operatorOf(expression);

  return operator
    ? EXPRESSIONS[operator](doc, expression[operator])
    : evaluateValue(doc, expression);
};

const applyStage = (doc, { $set }) => ({
  ...doc,
  ...Object.fromEntries(
    Object.entries($set).map(([key, value]) => [key, evaluate(doc, value)]),
  ),
});

const applyUpdate = (doc, update) =>
  Array.isArray(update)
    ? update.reduce(applyStage, doc)
    : applyInc({ ...doc, ...(update.$set ?? {}) }, update.$inc);

const sinceTheRedrive = (doc) =>
  doc.attemptHistory.filter(({ at }) => at > doc.lastRedrive.at);

// A failure lands at least a poll tick after the redrive that let it run.
const afterTheRedrive = (doc) =>
  vi.setSystemTime(Date.parse(doc.lastRedrive.at) + 1000);

const capture = async (method, run, resolved = null) => {
  const spy = vi.fn().mockResolvedValue(resolved);
  db.collection.mockReturnValue({ [method]: spy });

  await run();

  return spy.mock.calls.at(-1);
};

const aDeadLetter = () => ({
  status: "DEAD_LETTER",
  completionAttempts: MAX_RETRIES,
  claimedBy: null,
  claimedAt: null,
  claimExpiresAt: null,
  segregationRef: SEGREGATION_REF,
});

const aDeadLetterWithHistory = () => ({
  ...aDeadLetter(),
  attemptHistory: anAttemptHistory({
    length: MAX_RETRIES,
    message: "before the redrive",
  }),
  lastError: {
    name: "TypeError",
    message: "before the redrive",
    at: "2026-06-16T10:04:00.000Z",
  },
});

const INBOX_PROPS = {
  source: "GAS",
  event: { time: "2026-06-16T10:00:00.000Z" },
  segregationRef: SEGREGATION_REF,
};

const OUTBOX_PROPS = {
  target: "arn:aws:sns:eu-west-2:000000000000:topic.fifo",
  event: { time: "2026-06-16T10:00:00.000Z" },
  segregationRef: SEGREGATION_REF,
};

const failWithModel = (Model, doc, props) => {
  const model = Model.fromDocument({
    ...props,
    ...doc,
    attemptHistory: doc.attemptHistory ?? [],
  });

  model.markAsFailed(new Error("boom"));

  const next = model.toDocument();

  return {
    ...doc,
    status: next.status,
    completionAttempts: next.completionAttempts,
    attemptHistory: next.attemptHistory,
    claimedBy: null,
    claimedAt: null,
    claimExpiresAt: null,
  };
};

const BOXES = [
  {
    name: "inbox",
    redrive: () => redriveInbox(ID),
    claim: () => claimInbox("claim-token", SEGREGATION_REF, 1),
    resubmitted: resubmittedInbox,
    failed: failedInbox,
    dead: deadInbox,
    fail: (doc) => failWithModel(Inbox, doc, INBOX_PROPS),
  },
  {
    name: "outbox",
    redrive: () => redriveOutbox(ID),
    claim: () => claimOutbox("claim-token", SEGREGATION_REF),
    resubmitted: resubmittedOutbox,
    failed: failedOutbox,
    dead: deadOutbox,
    fail: (doc) => failWithModel(Outbox, doc, OUTBOX_PROPS),
  },
];

describe.each(BOXES)("redrive invariants ($name)", (box) => {
  let redriveFilter;
  let redriveDoc;
  let claimFilter;
  let resubmittedFilter;
  let resubmittedUpdate;
  let deadFilter;
  let failedFilter;
  let failedUpdate;

  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(async () => {
    [redriveFilter, redriveDoc] = await capture("updateOne", box.redrive, {
      matchedCount: 0,
    });
    [claimFilter] = await capture("findOneAndUpdate", box.claim);
    [resubmittedFilter, resubmittedUpdate] = await capture(
      "updateMany",
      box.resubmitted,
    );
    [deadFilter] = await capture("updateMany", box.dead);
    [failedFilter, failedUpdate] = await capture("updateMany", box.failed);
  });

  it("only matches a redrivable row, so a concurrent change loses cleanly", () => {
    expect(redriveFilter.status).toEqual({ $in: REDRIVABLE_STATUSES });
    expect(matchesFilter(aDeadLetter(), redriveFilter)).toBe(true);
    expect(
      matchesFilter({ ...aDeadLetter(), status: "COMPLETED" }, redriveFilter),
    ).toBe(false);
  });

  it("matches a PURGED row too", () => {
    expect(
      matchesFilter({ ...aDeadLetter(), status: "PURGED" }, redriveFilter),
    ).toBe(true);
  });

  // The purge is undone; the record of it is not.
  it("keeps lastPurge, so a redriven row still knows it was purged", () => {
    const lastPurge = {
      at: "2026-06-16T11:00:00.000Z",
      by: "ada",
      reasonCode: "BROKEN_PAYLOAD",
      note: null,
    };
    const redriven = applyUpdate(
      { ...aDeadLetter(), status: "PURGED", lastPurge },
      redriveDoc,
    );

    expect(redriveDoc[0].$set).not.toHaveProperty("lastPurge");
    expect(redriven.lastPurge).toEqual(lastPurge);
  });

  it("leaves the row RESUBMITTED with its attempts reset to 0", () => {
    const redriven = applyUpdate(aDeadLetter(), redriveDoc);

    expect(redriven.status).toBe("RESUBMITTED");
    expect(redriven.completionAttempts).toBe(0);
  });

  it("makes a row dead-lettered as permanent retryable again", () => {
    const redriven = applyUpdate(
      { ...aDeadLetter(), retryable: false },
      redriveDoc,
    );

    expect(redriven.retryable).toBe(true);
  });

  it("releases any claim", () => {
    const redriven = applyUpdate(aDeadLetter(), redriveDoc);

    expect(redriven.claimedBy).toBeNull();
    expect(redriven.claimedAt).toBeNull();
    expect(redriven.claimExpiresAt).toBeNull();
  });

  it("clears any deletion deadline, so a row in flight cannot be deleted", () => {
    const redriven = applyUpdate(
      { ...aDeadLetter(), expireAt: new Date("2026-12-16T10:00:00.000Z") },
      redriveDoc,
    );

    expect(redriveDoc[0].$set.expireAt).toBeNull();
    expect(redriven.expireAt).toBeNull();
  });

  it("keeps the attempts it reset the counter on, and records the redrive", () => {
    const stored = aDeadLetterWithHistory();
    const redriven = applyUpdate(stored, redriveDoc);

    expect(redriven.completionAttempts).toBe(0);
    expect(redriven.attemptHistory).toEqual(stored.attemptHistory);
    expect(redriven.history).toEqual([
      { kind: "redriven", at: redriven.lastRedrive.at, by: null },
    ]);
  });

  it("appends to a history already there", () => {
    const earlier = { kind: "dead-lettered", at: "2026-06-16T10:05:00.000Z" };
    const redriven = applyUpdate(
      { ...aDeadLetterWithHistory(), history: [earlier] },
      redriveDoc,
    );

    expect(redriven.history.map(({ kind }) => kind)).toEqual([
      "dead-lettered",
      "redriven",
    ]);
  });

  it("first stores what a row from before the history kept of its last redrive, purge, edit and death", () => {
    const legacy = {
      ...aDeadLetterWithHistory(),
      payloadRevision: 3,
      originalPayload: { n: 0 },
      lastEdit: { at: "2026-06-16T10:01:00.000Z", by: "bob", note: "fix" },
      lastPurge: {
        at: "2026-06-16T10:02:00.000Z",
        by: "cy",
        reasonCode: "OTHER",
        note: "why",
      },
      lastRedrive: { at: "2026-06-16T10:03:00.000Z", by: "ada" },
      lastResubmissionDate: "2026-06-16T10:04:00.000Z",
    };
    const redriven = applyUpdate(legacy, redriveDoc);

    expect(redriven.history).toEqual([
      {
        kind: "payload-edited",
        at: "2026-06-16T10:01:00.000Z",
        by: "bob",
        note: "fix",
      },
      {
        kind: "purged",
        at: "2026-06-16T10:02:00.000Z",
        by: "cy",
        reasonCode: "OTHER",
        note: "why",
      },
      { kind: "redriven", at: "2026-06-16T10:03:00.000Z", by: "ada" },
      { kind: "dead-lettered", at: "2026-06-16T10:04:00.000Z" },
      { kind: "redriven", at: redriven.lastRedrive.at, by: null },
    ]);
  });

  it("gives a derived edit the original payload when nothing else moved the revision since", () => {
    const legacy = {
      ...aDeadLetterWithHistory(),
      payloadRevision: 1,
      originalPayload: { n: 0 },
      lastEdit: { at: "2026-06-16T10:01:00.000Z", by: "bob", note: "fix" },
    };
    const redriven = applyUpdate(legacy, redriveDoc);

    expect(redriven.history[0]).toEqual({
      kind: "payload-edited",
      at: "2026-06-16T10:01:00.000Z",
      by: "bob",
      note: "fix",
      before: { n: 0 },
    });
  });

  it("stores a death since the last redrive that only lastResubmissionDate holds", () => {
    const lastRedrive = { at: "2026-06-16T10:03:00.000Z", by: "ada" };
    const history = [
      { kind: "dead-lettered", at: "2026-06-16T10:00:00.000Z" },
      { kind: "redriven", ...lastRedrive },
    ];
    const redriven = applyUpdate(
      {
        ...aDeadLetterWithHistory(),
        lastRedrive,
        lastResubmissionDate: "2026-06-16T10:04:00.000Z",
        history,
      },
      redriveDoc,
    );

    expect(redriven.history).toEqual([
      ...history,
      { kind: "dead-lettered", at: "2026-06-16T10:04:00.000Z" },
      { kind: "redriven", at: redriven.lastRedrive.at, by: null },
    ]);
  });

  it("derives no death when one is stored since the last redrive", () => {
    const lastRedrive = { at: "2026-06-16T10:03:00.000Z", by: "ada" };
    const history = [
      { kind: "redriven", ...lastRedrive },
      { kind: "dead-lettered", at: "2026-06-16T10:04:00.000Z" },
    ];
    const redriven = applyUpdate(
      {
        ...aDeadLetterWithHistory(),
        lastRedrive,
        lastResubmissionDate: "2026-06-16T10:03:59.000Z",
        history,
      },
      redriveDoc,
    );

    expect(redriven.history).toEqual([
      ...history,
      { kind: "redriven", at: redriven.lastRedrive.at, by: null },
    ]);
  });

  it("merges what it derives into the stored history by time", () => {
    const lastRedrive = { at: "2026-06-16T10:03:00.000Z", by: "ada" };
    const later = { kind: "dead-lettered", at: "2026-06-16T10:04:00.000Z" };
    const redriven = applyUpdate(
      {
        ...aDeadLetterWithHistory(),
        lastRedrive,
        lastResubmissionDate: later.at,
        history: [later],
      },
      redriveDoc,
    );

    expect(redriven.history).toEqual([
      { kind: "redriven", ...lastRedrive },
      later,
      { kind: "redriven", at: redriven.lastRedrive.at, by: null },
    ]);
  });

  it("derives nothing a stored history already holds", () => {
    const lastRedrive = { at: "2026-06-16T10:03:00.000Z", by: "ada" };
    const history = [
      { kind: "redriven", ...lastRedrive },
      { kind: "dead-lettered", at: "2026-06-16T10:04:00.000Z" },
    ];
    const redriven = applyUpdate(
      {
        ...aDeadLetterWithHistory(),
        lastRedrive,
        lastResubmissionDate: "2026-06-16T10:04:00.000Z",
        history,
      },
      redriveDoc,
    );

    expect(redriven.history).toEqual([
      ...history,
      { kind: "redriven", at: redriven.lastRedrive.at, by: null },
    ]);
  });

  // What GAS serves as `attemptHistory`: the attempts after `lastRedrive.at`,
  // which is what the list meant when a redrive emptied it.
  it("leaves the first failure after a redrive as the only attempt since it", () => {
    const redriven = applyUpdate(
      applyUpdate(aDeadLetterWithHistory(), redriveDoc),
      resubmittedUpdate,
    );

    afterTheRedrive(redriven);
    const failed = box.fail(redriven);

    expect(failed.completionAttempts).toBe(1);
    expect(failed.attemptHistory).toHaveLength(MAX_RETRIES + 1);
    expect(sinceTheRedrive(failed)).toHaveLength(1);
    expect(sinceTheRedrive(failed)[0].message).toBe("boom");
  });

  it("keeps lastError and lastResubmissionDate - the record of why it died", () => {
    const lastError = { name: "TypeError", message: "boom", at: null };
    const redriven = applyUpdate(
      {
        ...aDeadLetter(),
        lastError,
        lastResubmissionDate: "2026-06-16T10:00:00.000Z",
      },
      redriveDoc,
    );

    expect(redriven.lastError).toEqual(lastError);
    expect(redriven.lastResubmissionDate).toBe("2026-06-16T10:00:00.000Z");
  });

  it("survives the next poll tick and is claimable", () => {
    const redriven = applyUpdate(aDeadLetter(), redriveDoc);

    expect(matchesFilter(redriven, resubmittedFilter)).toBe(true);

    const published = applyUpdate(redriven, resubmittedUpdate);

    expect(published.status).toBe("PUBLISHED");
    expect(published.completionAttempts).toBe(0);
    expect(matchesFilter(published, deadFilter)).toBe(false);
    expect(matchesFilter(published, claimFilter)).toBe(true);
  });

  it("would be unclaimable if the redrive left completionAttempts alone", () => {
    const withoutReset = [
      { $set: { ...redriveDoc[0].$set, completionAttempts: MAX_RETRIES } },
    ];
    const redriven = applyUpdate(aDeadLetter(), withoutReset);
    const published = applyUpdate(redriven, resubmittedUpdate);

    expect(published.completionAttempts).toBe(MAX_RETRIES);
    expect(matchesFilter(published, deadFilter)).toBe(true);
    expect(matchesFilter(published, claimFilter)).toBe(false);
  });

  it("gives a redriven row the same number of fresh attempts as a new one, and the counter and the history agree", () => {
    let doc = applyUpdate(
      applyUpdate(aDeadLetter(), redriveDoc),
      resubmittedUpdate,
    );
    let attempts = 0;

    while (matchesFilter(doc, claimFilter) && attempts < 100) {
      attempts += 1;

      doc = box.fail(doc);

      expect(matchesFilter(doc, failedFilter)).toBe(true);
      doc = applyUpdate(doc, failedUpdate);
      doc = applyUpdate(doc, resubmittedUpdate);

      if (matchesFilter(doc, deadFilter)) {
        doc = { ...doc, status: "DEAD_LETTER" };
      }
    }

    expect(attempts).toBe(MAX_RETRIES);
    expect(doc.status).toBe("DEAD_LETTER");
    expect(doc.completionAttempts).toBe(MAX_RETRIES);
    expect(doc.attemptHistory).toHaveLength(MAX_RETRIES);
  });

  it("redrives a row that already has a history into one whose attempts since agree with its counter", () => {
    let doc = applyUpdate(
      applyUpdate(aDeadLetterWithHistory(), redriveDoc),
      resubmittedUpdate,
    );
    afterTheRedrive(doc);
    let attempts = 0;

    while (matchesFilter(doc, claimFilter) && attempts < 100) {
      attempts += 1;

      doc = applyUpdate(
        applyUpdate(box.fail(doc), failedUpdate),
        resubmittedUpdate,
      );

      if (matchesFilter(doc, deadFilter)) {
        doc = { ...doc, status: "DEAD_LETTER" };
      }
    }

    expect(attempts).toBe(MAX_RETRIES);
    expect(doc.status).toBe("DEAD_LETTER");
    expect(doc.completionAttempts).toBe(MAX_RETRIES);
    expect(doc.attemptHistory).toHaveLength(MAX_RETRIES * 2);
    expect(sinceTheRedrive(doc)).toHaveLength(MAX_RETRIES);
    expect(sinceTheRedrive(doc).map((entry) => entry.message)).not.toContain(
      "before the redrive",
    );
  });
});

describe("redrivable statuses", () => {
  it("is DEAD_LETTER and PURGED - an operator may change their mind", () => {
    expect(REDRIVABLE_STATUSES).toEqual(["DEAD_LETTER", "PURGED"]);
  });

  it("is a wider idea than DEAD_LETTER, which means 'needs attention'", () => {
    expect(REDRIVABLE_STATUSES).toContain(DEAD_LETTER);
    expect(DEAD_LETTER).toBe("DEAD_LETTER");
  });
});

describe("redriveConflict", () => {
  it("is a 409", () => {
    expect(redriveConflict("Inbox", ID, "COMPLETED").output.statusCode).toBe(
      409,
    );
  });

  it("puts the current status in the body", () => {
    expect(
      redriveConflict("Inbox", ID, "COMPLETED").output.payload.status,
    ).toBe("COMPLETED");
  });

  it("names the box, the id and the blocking status in the message", () => {
    const message = redriveConflict("Outbox", ID, "PUBLISHED").output.payload
      .message;

    expect(message).toContain("Outbox");
    expect(message).toContain(ID);
    expect(message).toContain("PUBLISHED");
    expect(message).toContain(DEAD_LETTER);
  });

  it("says the row is not redrivable, naming both statuses that are", () => {
    const message = redriveConflict("Inbox", ID, "COMPLETED").output.payload
      .message;

    expect(message).toBe(
      `Inbox event "${ID}" is COMPLETED, not redrivable (DEAD_LETTER or PURGED)`,
    );
  });
});
