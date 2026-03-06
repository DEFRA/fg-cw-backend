import Boom from "@hapi/boom";
import { logger } from "../../common/logger.js";
import { withTransaction } from "../../common/with-transaction.js";
import {
  findByCaseRefAndWorkflowCode,
  save,
} from "../repositories/case-series.repository.js";
import { findByCaseRefAndWorkflowCode as findCase } from "../repositories/case.repository.js";
import { newCaseUseCase } from "./new-case.use-case.js";

const isReplacementAllowed = (kase) => {
  // TODO: this will be filled when we have case "closed" status FGP-815
  return false;
};

export const replaceCaseUseCase = async (message) => {
  return await withTransaction(async (session) => {
    const {
      event: { data },
    } = message;
    const { caseRef, previousCaseRef, workflowCode } = data;

    logger.info(
      `Replacing case with previousCaseRef ${previousCaseRef} and workflowCode ${workflowCode}`,
    );

    const previousCase = await findCase(previousCaseRef, workflowCode, session);

    if (isReplacementAllowed(previousCase)) {
      const kaseId = await newCaseUseCase(message, session);
      // update series
      const caseSeries = await findByCaseRefAndWorkflowCode(
        caseRef,
        workflowCode,
        session,
      );
      caseSeries.addCaseRef(caseRef, kaseId.toString());
      await save(caseSeries, session);
    } else {
      throw Boom.conflict(
        `Can not replace existing Case with caseRef: ${previousCaseRef} with new caseRef: ${caseRef} - replacement is not allowed`,
      );
    }

    logger.info(
      `Finished: replacing case with previousCaseRef ${previousCaseRef} and workflowCode ${workflowCode}`,
    );
  });
};
