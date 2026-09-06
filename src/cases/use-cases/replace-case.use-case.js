import Boom from "@hapi/boom";
import { logger } from "../../common/logger.js";
import { withAudit } from "../../common/with-audit.js";
import { withTransaction } from "../../common/with-transaction.js";
import {
  findByCaseRefAndWorkflowCode,
  update,
} from "../repositories/case-series.repository.js";
import { findByCaseRefAndWorkflowCode as findCase } from "../repositories/case.repository.js";
import {
  newCaseAuditDataBuilder,
  newCaseUseCase,
} from "./new-case.use-case.js";

const isReplacementAllowed = (kase) => {
  return kase.closed;
};

const replaceCase = async (message) => {
  return await withTransaction(async (session) => {
    const {
      event: { data },
    } = message;
    const { caseRef, previousCaseRef, workflowCode } = data;

    logger.info(
      `Replacing case with previousCaseRef ${previousCaseRef} and workflowCode ${workflowCode}`,
    );

    const previousCase = await findCase(previousCaseRef, workflowCode, session);

    if (!isReplacementAllowed(previousCase)) {
      throw Boom.conflict(
        `Can not replace existing Case with caseRef: ${previousCaseRef} with new caseRef: ${caseRef} - replacement is not allowed`,
      );
    }

    const kaseId = await newCaseUseCase(message, session);
    // update series
    const caseSeries = await findByCaseRefAndWorkflowCode(
      previousCaseRef,
      workflowCode,
      session,
    );
    caseSeries.addCaseRef(caseRef, kaseId.toString());
    await update(caseSeries, session);

    logger.info(
      `Finished: replacing case with previousCaseRef ${previousCaseRef} and workflowCode ${workflowCode}`,
    );

    return kaseId;
  });
};

export const replaceCaseUseCase = withAudit(
  replaceCase,
  newCaseAuditDataBuilder,
);
