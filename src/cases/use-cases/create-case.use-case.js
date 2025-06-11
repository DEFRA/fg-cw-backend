import { Case } from "../models/case.js";
import { save } from "../repositories/case.repository.js";
import { findWorkflowByCodeUseCase } from "./find-workflow-by-code.use-case.js";

export const createCaseUseCase = async (command) => {
  const workflow = await findWorkflowByCodeUseCase(command.code);

  const kase = Case.fromWorkflow(workflow, command);

  await save(kase);

  return kase;
};
