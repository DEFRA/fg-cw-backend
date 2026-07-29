import { withAudit } from "../../common/with-audit.js";
import { withTransaction } from "../../common/with-transaction.js";
import { CaseSeries } from "../models/case-series.js";
import { save as saveSeries } from "../repositories/case-series.repository.js";
import {
  newCaseAuditDataBuilder,
  newCaseUseCase,
} from "./new-case.use-case.js";
import { replaceCaseUseCase } from "./replace-case.use-case.js";

const createCase = async (message) => {
  const {
    event: {
      data: { caseRef, workflowCode },
    },
  } = message;

  return await withTransaction(async (session) => {
    const kaseId = await newCaseUseCase(message, session);

    const caseSeries = CaseSeries.new({
      workflowCode,
      caseRef,
      caseId: kaseId.toString(),
    });

    await saveSeries(caseSeries, session);

    return kaseId;
  });
};

const createCaseWithAudit = withAudit(createCase, newCaseAuditDataBuilder);

export const submitCaseUseCase = async (message) => {
  const {
    event: {
      data: { previousCaseRef },
    },
  } = message;

  // The replace path delegates to replaceCaseUseCase, which is already audited,
  // so only the new-case path is wrapped here to avoid a duplicate audit event.
  if (previousCaseRef) {
    await replaceCaseUseCase(message);
  } else {
    await createCaseWithAudit(message);
  }
};
