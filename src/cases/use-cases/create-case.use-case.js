import { Case } from "../models/case.js";
import { publishCaseStatusUpdated } from "../publishers/case-event.publisher.js";
import { save } from "../repositories/case.repository.js";
import { findWorkflowByCodeUseCase } from "./find-workflow-by-code.use-case.js";

export const createCaseUseCase = async ({ caseRef, workflowCode, payload }) => {
  const workflow = await findWorkflowByCodeUseCase(workflowCode);

  const kase = Case.new({
    caseRef,
    payload,
    workflow,
  });

  await save(kase);

  // FGP-659 - send event back to GAS to update the status to IN_PROGRESS
  // This can be removed when we have state transitions in CW-BE
  await publishCaseStatusUpdated({
    caseRef,
    workflowCode: kase.workflowCode,
    previousStatus: "NEW",
    currentStatus: "IN_PROGRESS",
  });

  return kase;
};
