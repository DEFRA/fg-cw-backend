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

      const date = new Date(Date.now()).toISOString();
      const caseSeries = CaseSeries.new({
        caseRefs: [caseRef],
        latestCaseRef: caseRef,
        latestCaseId: kaseId.toString(),
        updatedAt: date,
        createdAt: date,
        workflowCode,
      });

      await saveSeries(caseSeries, session);
    });
  }
};
