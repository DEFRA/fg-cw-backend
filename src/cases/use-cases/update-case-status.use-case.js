import Boom from "@hapi/boom";
import {
  findByCaseRefAndWorkflowCode,
  update,
} from "../repositories/case.repository.js";

export const updateCaseStatusUseCase = async ({
  caseRef,
  workflowCode,
  newStatus,
  supplementaryData,
}) => {
  const kase = await findByCaseRefAndWorkflowCode(caseRef, workflowCode);

  if (!kase) {
    throw Boom.notFound(`Case with ref "${caseRef}" not found`);
  }

  kase.updateCaseStatus(newStatus);
  kase.addDataToStage(supplementaryData);

  await update(kase);

  return kase;
};
