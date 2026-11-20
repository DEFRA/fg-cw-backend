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
import { isWithinLimits } from "../../common/explore/query-schema.js";
import { refusalOf, refuseQuery } from "../../common/explore/refusal.js";
import { answerOfRefusal } from "../../common/explore-answers.js";
import { runPart } from "../../common/explore/run.js";
import { logger } from "../../common/logger.js";
import { findOwnSource } from "../explore/sources.js";

const resultCountOf = (part) =>
  part.groups
    ? part.groups.length
    : part.boxes.reduce((total, { rows }) => total + rows.length, 0);

// A part whose window ended early, out of work, is partial.
const isPartial = (result) =>
  result.boxes.some(({ partial }) => partial === true);

const answeredAs = (result) => (isPartial(result) ? "PARTIAL" : "ANSWERED");

const outcomeOf = (error, result) =>
  error ? (refusalOf(error) ?? "FAILED") : answeredAs(result);

// That a person queried one of Caseworking's sources, how it ended and how
// much it found; never what was asked. GAS's own audit says whether it was
// for a CSV.
export const exploreQueryAuditBuilder = (
  { query, operator },
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
    source: query.source,
    resultCount: result ? resultCountOf(result) : null,
    outcome: outcomeOf(error, result),
  },
  security: buildAuditSecurity(auditActions.EXPLORE_QUERY),
  segregationRef: "admin-explore",
});

const auditedPart = auditedRead(
  ({ source, query, meter }) => runPart(source, query, meter),
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

  logger.info(`Finished: Explore query on ${source.name}`);

  return part;
};

// Caseworking's part of one Explore query, one at a time per operator.
export const exploreQueryUseCase = (args) =>
  oneAtATime(args.operator.id, () => readPart(args)).catch(answerOfRefusal);
