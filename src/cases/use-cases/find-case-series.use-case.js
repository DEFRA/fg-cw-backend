import Boom from "@hapi/boom";
import { CaseSeriesDetail } from "../models/case-series-detail.js";
import { findInCaseRefsAndWorkflowCode } from "../repositories/case-series.repository.js";
import {
  findByCaseRefAndWorkflowCode,
  findCasesByCaseRefsAndWorkflowCode,
} from "../repositories/case.repository.js";
import { resolveCurrentWorkflowUseCase } from "./resolve-current-workflow.use-case.js";

const TIMELINE = "timeline";

const getCaseDetailsForSeries = async (currentCaseRef, caseRefs, workflow) => {
  const caseDocs = await findCasesByCaseRefsAndWorkflowCode(
    caseRefs,
    workflow.code,
  );
  return caseDocs.map((doc) =>
    CaseSeriesDetail.fromCase(doc, currentCaseRef, workflow),
  );
};

const resolveTimelineSeries = async (caseRef, workflowCode, doc) => {
  const currentCase = await findByCaseRefAndWorkflowCode(caseRef, workflowCode);
  const { workflow } = await resolveCurrentWorkflowUseCase(
    workflowCode,
    currentCase?.originalConfigVersion ?? null,
  );

  if (!workflow) {
    throw Boom.notFound(`Workflow not found: ${workflowCode}`);
  }

  const seriesDetails = await getCaseDetailsForSeries(
    caseRef,
    Array.from(doc.caseRefs),
    workflow,
  );
  return { length: seriesDetails.length, seriesDetails };
};

export const findCaseSeries = async ({ caseRef, workflowCode, tabId }) => {
  const doc = await findInCaseRefsAndWorkflowCode(caseRef, workflowCode);

  if (tabId === TIMELINE) {
    return resolveTimelineSeries(caseRef, workflowCode, doc);
  }

  return { length: doc.caseRefs.size };
};
