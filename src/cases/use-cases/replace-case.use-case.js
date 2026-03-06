import { logger } from "../../common/logger.js";
import { withTransaction } from "../../common/with-transaction.js";
import {
  findByCaseRefAndWorkflowCode,
  save,
} from "../repositories/case-series.repository.js";
import { newCaseUseCase } from "./new-case.use-case.js";

export const replaceCaseUseCase = async (message) => {
  return await withTransaction(async (session) => {
    const {
      event: { data },
    } = message;
    const { caseRef, previousCaseRef, workflowCode } = data;

    logger.info(
      `Replacing case with previousCaseRef ${previousCaseRef} and workflowCode ${workflowCode}`,
    );

    const kaseId = await newCaseUseCase(message, session);
    // update series
    const caseSeries = await findByCaseRefAndWorkflowCode(
      caseRef,
      workflowCode,
      session,
    );
    caseSeries.addCaseRef(caseRef, kaseId.toString());
    await save(caseSeries, session);

    logger.info(
      `Finished: replacing case with previousCaseRef ${previousCaseRef} and workflowCode ${workflowCode}`,
    );
  });
};
