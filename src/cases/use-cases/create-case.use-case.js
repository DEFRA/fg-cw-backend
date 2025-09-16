import { Case } from "../models/case.js";
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

  return kase;
};
