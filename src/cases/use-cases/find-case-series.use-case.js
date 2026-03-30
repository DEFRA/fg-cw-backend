import { CaseSeriesDetail } from "../models/case-series-detail.js";
import { findInCaseRefsAndWorkflowCode } from "../repositories/case-series.repository.js";
import { findCasesByCaseRefsAndWorkflowCode } from "../repositories/case.repository.js";
import { findByCode } from "../repositories/workflow.repository.js";

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

export const findCaseSeries = async ({ caseRef, workflowCode, tabId }) => {
  const doc = await findInCaseRefsAndWorkflowCode(caseRef, workflowCode);

  if (tabId === TIMELINE) {
    const workflow = await findByCode(workflowCode);
    const seriesDetails = await getCaseDetailsForSeries(
      caseRef,
      Array.from(doc.caseRefs),
      workflow,
    );
    return {
      length: seriesDetails.length,
      seriesDetails,
    };
  } else {
    return {
      length: doc.caseRefs.size,
    };
  }
};
