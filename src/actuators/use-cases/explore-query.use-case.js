import {
  auditActions,
  auditEntities,
  buildAuditSecurity,
} from "../../common/audit-constants.js";
import { buildOperatorSecurityContext } from "../../common/audit-security-context.js";
import { auditedRead } from "../../common/audited-read.js";
import { oneAtATime } from "../../common/explore/busy.js";
import { meterFor } from "../../common/explore/meter.js";
import {
  keepsRules,
  refusedPathsOf,
} from "../../common/explore/query-rules.js";
import { sentBytes } from "../../common/explore/large-answers.js";
import {
  DOCUMENTS_MODE,
  isWithinLimits,
} from "../../common/explore/query-schema.js";
import { refusalOf, refuseQuery } from "../../common/explore/refusal.js";
import { answerOfRefusal } from "../../common/explore-answers.js";
import { runPart } from "../../common/explore/run.js";
import { logger } from "../../common/logger.js";
import { findOwnSource } from "../explore/sources.js";

// A part read: the rows or groups it found, partial when a window ended
// early, out of work.
const READ = {
  countOf: (part) =>
    part.groups
      ? part.groups.length
      : part.boxes.reduce((total, { rows }) => total + rows.length, 0),
  isPartial: (part) => part.boxes.some(({ partial }) => partial === true),
};

// A `documents` fetch: the documents or starts it sent, partial when it
// ended before the last row asked, and only their bytes logged, joined
// records included, never a value of them.
const FETCH = {
  countOf: (part) =>
    part.documents.filter(({ doc, start }) => doc || start).length,
  isPartial: (part, query) => part.documents.length < query.rows.length,
  loggedOf: (part) => `, documents.bytes ${sentBytes(part.documents)}`,
};

const kindOf = (query) => (query.mode === DOCUMENTS_MODE ? FETCH : READ);

const answeredAs = (kind, result, query) =>
  kind.isPartial(result, query) ? "PARTIAL" : "ANSWERED";

const outcomeOf = (kind, error, { result, query }) =>
  error ? (refusalOf(error) ?? "FAILED") : answeredAs(kind, result, query);

// That a person queried one of Caseworking's sources, how it ended and how
// much it found; never what was asked. A `documents` fetch is audited as
// one, for the records it sends. GAS's own audit says which download it was
// for, CSV or JSON, if any.
export const exploreQueryAuditBuilder = (
  { query, operator },
  result,
  error,
) => {
  const kind = kindOf(query);

  return {
    entities: [
      {
        entity: auditEntities.EXPLORE_SOURCE,
        action: auditActions.EXPLORE_QUERY,
        entityid: query.source,
      },
    ],
    details: {
      security: buildOperatorSecurityContext(operator),
      source: query.source,
      resultCount: result ? kind.countOf(result) : null,
      outcome: outcomeOf(kind, error, { result, query }),
    },
    security: buildAuditSecurity(auditActions.EXPLORE_QUERY),
    segregationRef: "admin-explore",
  };
};

const auditedPart = auditedRead(
  ({ source, query, meter }) => runPart(source, query, meter),
  exploreQueryAuditBuilder,
);

// The Query's rules, a fetch's rows among them, are checked again before
// anything is read, so a refused Query writes no audit.
const checkedSource = (query) => {
  const source = findOwnSource(query.source);

  if (!source || !isWithinLimits(query) || !keepsRules(source, query)) {
    throw refuseQuery("INVALID");
  }

  return source;
};

// GAS's time runs from when the query arrived.
const deadlineOf = (timeLeftMs) => Date.now() + timeLeftMs;

// GAS ending the request, having given up, stops the read at its next check.
const meterOf = (deadline, signal) => {
  const meter = meterFor(signal?.aborted ? 0 : deadline);

  signal?.addEventListener("abort", () => {
    meter.deadline = 0;
  });

  return meter;
};

// A Query reading a malformed path is refused here, before the audit, so it
// writes none; the read's own check of it would be audited as a failure.
const checkPaths = (query) => {
  if (refusedPathsOf(query) > 0) {
    throw refuseQuery("PATH_NOT_ALLOWED");
  }
};

const readPart = async ({ query, operator, timeLeftMs, signal }) => {
  const deadline = deadlineOf(timeLeftMs);
  const source = checkedSource(query);

  checkPaths(query);

  logger.info(`Explore query on ${source.name}`);

  const part = await auditedPart({
    source,
    query,
    operator,
    meter: meterOf(deadline, signal),
  });

  const logged = kindOf(query).loggedOf?.(part) ?? "";

  logger.info(`Finished: Explore query on ${source.name}${logged}`);

  return part;
};

// Caseworking's part of one Explore query, one at a time per operator.
export const exploreQueryUseCase = (args) =>
  oneAtATime(args.operator.id, () => readPart(args)).catch(answerOfRefusal);
