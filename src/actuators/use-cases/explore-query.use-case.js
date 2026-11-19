import {
  auditActions,
  auditEntities,
  buildAuditSecurity,
} from "../../common/audit-constants.js";
import { buildOperatorSecurityContext } from "../../common/audit-security-context.js";
import { auditedRead } from "../../common/audited-read.js";
import { config } from "../../common/config.js";
import {
  conditionsOf,
  knownWordsOf,
  queryShapeOf,
} from "../../common/explore/audit.js";
import { oneAtATime } from "../../common/explore/busy.js";
import { rootsOf } from "../../common/explore/describe.js";
import { pathsOfQuery } from "../../common/explore/fields.js";
import { meterFor } from "../../common/explore/meter.js";
import {
  keepsRules,
  refusedPathsOf,
} from "../../common/explore/query-rules.js";
import { isWithinLimits } from "../../common/explore/query-schema.js";
import { refusalOf, refuseQuery } from "../../common/explore/refusal.js";
import {
  answerOfRefusal,
  queryUnauditable,
} from "../../common/explore-answers.js";
import { runPart } from "../../common/explore/run.js";
import { logger } from "../../common/logger.js";
import { loadAnswerListUseCase } from "./load-answer-list.use-case.js";
import { findOwnSource } from "../explore/sources.js";

const listedPathsOf = (answers) =>
  answers ? answers.paths.map((path) => `${answers.at}.${path}`) : [];

// The words a source's own paths, and the answers it lists, are made of,
// which its audit shows as written; any other segment shows as ?.
const wordsOf = (source, answers) =>
  knownWordsOf([
    ...rootsOf(source),
    ...source.paths.map(({ path }) => path),
    ...listedPathsOf(answers),
  ]);

const resultCountOf = (part) =>
  part.groups
    ? part.groups.length
    : part.boxes.reduce((total, { rows }) => total + rows.length, 0);

// How the part was read, how much it found, and how many records it skipped
// as too large to search.
const resultDetails = (result) =>
  result
    ? {
        read: result.read,
        resultCount: resultCountOf(result),
        skipped: skippedOf(result),
      }
    : { read: undefined, resultCount: undefined, skipped: 0 };

// Records the part skipped as too large to search.
const skippedOf = (result) =>
  result.boxes.reduce((n, { skipped = 0 }) => n + skipped, 0);

// A part whose window ended early, out of work, is partial.
const isPartial = (result) =>
  result.boxes.some(({ partial }) => partial === true);

const answeredAs = (result) => (isPartial(result) ? "PARTIAL" : "ANSWERED");

const outcomeOf = (error, result) =>
  error ? (refusalOf(error) ?? "FAILED") : answeredAs(result);

// Caseworking's part of a query: its shape with every value as ?, the
// paths and operators of its conditions, each value only as a digest.
export const exploreQueryAuditBuilder = (
  { query, known, operator, caller, startedAt },
  result,
  error,
) => ({
  entities: [
    {
      entity: auditEntities.EXPLORE_SOURCE,
      action: auditActions.EXPLORE_QUERY,
      entityid: query.source,
    },
  ],
  details: {
    security: buildOperatorSecurityContext(operator),
    caller,
    source: query.source,
    shape: queryShapeOf(query, known),
    conditions: conditionsOf(query.where, config.get("searchAuditKey"), known),
    window: query.positions ? "next" : "first",
    ...resultDetails(result),
    tookMs: Date.now() - startedAt,
    outcome: outcomeOf(error, result),
  },
  security: buildAuditSecurity(auditActions.EXPLORE_QUERY),
  segregationRef: "admin-explore",
});

const auditedPart = auditedRead(
  ({ source, query, meter, answers }) => runPart(source, query, meter, answers),
  exploreQueryAuditBuilder,
);

// Every rule GAS's checker applies is checked before anything is read, so a
// refused Query writes no audit.
const checkedSource = (query) => {
  const source = findOwnSource(query.source);

  if (!source || !isWithinLimits(query) || !keepsRules(source, query)) {
    throw refuseQuery("INVALID");
  }

  return source;
};

// GAS's time runs from when the query arrived, answer-list load included.
const deadlineOf = (timeLeftMs) => Date.now() + timeLeftMs;

// GAS ending the request, having given up, stops the read at its next check.
const meterOf = (deadline, signal) => {
  const meter = meterFor(signal?.aborted ? 0 : deadline);

  signal?.addEventListener("abort", () => {
    meter.deadline = 0;
  });

  return meter;
};

const readsAnswers = (source, query) =>
  Boolean(source.listedAt) &&
  pathsOfQuery(query).some(
    (path) =>
      path === source.listedAt || path.startsWith(`${source.listedAt}.`),
  );

// The answers a Query reads are checked against Caseworking's own list,
// read only when it reads one.
const answersOf = async (source, query) =>
  readsAnswers(source, query)
    ? { ...(await loadAnswerListUseCase()), at: source.listedAt }
    : null;

// Every path the Query reads is checked against Caseworking's own roots and
// lists, and one off them refuses the whole Query: none is dropped to read
// the rest. The refusal is logged once, as it is answered.
const checkPaths = async (source, query) => {
  const answers = await answersOf(source, query);
  const refused = refusedPathsOf(query, { roots: rootsOf(source), answers });

  if (refused > 0) {
    throw refuseQuery("PATH_NOT_ALLOWED");
  }

  return answers;
};

// Without the key no value could be digested, so no query is read.
const assertAuditable = () => {
  if (!config.get("searchAuditKey")) {
    logger.error("Explore can't audit queries: SEARCH_AUDIT_KEY isn't set");

    throw queryUnauditable();
  }
};

const readPart = async ({ query, operator, caller, timeLeftMs, signal }) => {
  const deadline = deadlineOf(timeLeftMs);
  const source = checkedSource(query);

  assertAuditable();

  const answers = await checkPaths(source, query);

  logger.info(`Explore query on ${source.name}`);

  const part = await auditedPart({
    source,
    query,
    known: wordsOf(source, answers),
    answers,
    operator,
    caller,
    meter: meterOf(deadline, signal),
    startedAt: Date.now(),
  });

  logger.info(`Finished: Explore query on ${source.name}`);

  return part;
};

// Caseworking's part of one Explore query, one at a time per operator.
export const exploreQueryUseCase = (args) =>
  oneAtATime(args.operator.id, () => readPart(args)).catch(answerOfRefusal);
