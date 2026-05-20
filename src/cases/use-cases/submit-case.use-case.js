import { withTransaction } from "../../common/with-transaction.js";
import { CaseSeries } from "../models/case-series.js";
import { save as saveSeries } from "../repositories/case-series.repository.js";
import { newCaseUseCase } from "./new-case.use-case.js";
import { replaceCaseUseCase } from "./replace-case.use-case.js";

export const submitCaseUseCase = async (message) => {
  const {
    event: {
      data: { caseRef, previousCaseRef, workflowCode },
    },
  } = message;

  if (previousCaseRef) {
    await replaceCaseUseCase(message);
  } else {
    await withTransaction(async (session) => {
      const kaseId = await newCaseUseCase(message, session);

      const caseSeries = CaseSeries.new({
        workflowCode,
        caseRef,
        caseId: kaseId.toString(),
      });

      await saveSeries(caseSeries, session);
    });
  }
};
