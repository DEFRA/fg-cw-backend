import {
  countCaseList,
  findCaseListBySeries,
  findCaseListPage,
} from "../../cases/repositories/case.repository.js";
import { findByCaseRef } from "../../cases/repositories/case-series.repository.js";
import { findAllCodes } from "../../cases/repositories/workflow.repository.js";
import {
  byNewestFirst,
  toCaseRow,
} from "../../cases/use-cases/admin-case-read.use-case.js";
import {
  auditActions,
  auditEntities,
  buildAuditSecurity,
} from "../../common/audit-constants.js";
import { buildOperatorSecurityContext } from "../../common/audit-security-context.js";
import { actuatorReadMaxTimeMs } from "../../common/actuator-read.js";
import { auditedRead } from "../../common/audited-read.js";
import { logger } from "../../common/logger.js";

const COUNT_CAP = 10_000;
// A series is a handful of cases, so this only bounds a pathological one.
const SEARCH_LIMIT = 200;

const cappedTotal = (count, cap) => ({
  count: Math.min(count, cap),
  capped: count > cap,
});

const wantsTotal = ({ cursor, withTotal }) => !cursor && withTotal !== false;

const browse = async (query) => {
  const [page, count] = await Promise.all([
    findCaseListPage(query),
    wantsTotal(query) ? countCaseList(query, COUNT_CAP + 1) : undefined,
  ]);

  return {
    cases: page.data.map(toCaseRow),
    pagination: {
      endCursor: page.pagination.endCursor,
      hasNextPage: page.pagination.hasNextPage,
    },
    total: count === undefined ? undefined : cappedTotal(count, COUNT_CAP),
  };
};

// One page holds the whole match, so it never has a next one.
const search = async (query) => {
  const series = await findByCaseRef(query);
  const docs = await findCaseListBySeries(
    { ...query, series },
    SEARCH_LIMIT + 1,
  );

  return {
    cases: docs.sort(byNewestFirst).slice(0, SEARCH_LIMIT).map(toCaseRow),
    pagination: { endCursor: null, hasNextPage: false },
    total: wantsTotal(query)
      ? cappedTotal(docs.length, SEARCH_LIMIT)
      : undefined,
  };
};

const modeOf = (query) => (query.ref ? "search" : "browse");

const searchCases = async ({ query }) => {
  const mode = modeOf(query);

  logger.info(`Finding cases for the admin surface: ${mode}`);

  const [result, workflowCodes] = await Promise.all([
    query.ref ? search(query) : browse(query),
    query.cursor
      ? undefined
      : findAllCodes({}, { maxTimeMS: actuatorReadMaxTimeMs() }),
  ]);

  logger.info(`Finished: Finding cases for the admin surface: ${mode}`);

  return { ...result, workflowCodes };
};

// Absent values are dropped from the audit event, so they need no default.
const searchDetails = (query) => ({
  mode: modeOf(query),
  workflowCode: query.workflowCode,
  from: query.from,
  to: query.to,
  page: query.cursor ? "next" : "first",
});

export const searchCasesAuditBuilder = (
  { query, operator, caller, repeat },
  result,
) => ({
  entities: [
    {
      entity: auditEntities.CASE,
      action: auditActions.FIND_CASES,
      entityid: "search",
    },
  ],
  details: {
    security: buildOperatorSecurityContext(operator),
    caller,
    ...searchDetails(query),
    resultCount: result?.cases.length,
    total: result?.total,
    repeat,
  },
  security: buildAuditSecurity(auditActions.FIND_CASES),
  segregationRef: "admin-search-cases",
});

export const searchCasesUseCase = auditedRead(
  searchCases,
  searchCasesAuditBuilder,
);
