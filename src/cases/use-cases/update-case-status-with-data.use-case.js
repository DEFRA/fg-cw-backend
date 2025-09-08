import Boom from "@hapi/boom";
import { getAuthenticatedUser } from "../../common/auth.js";
import {
  findByCaseRefAndWorkflowCode,
  update,
} from "../repositories/case.repository.js";

export const updateCaseStatusWithDataUseCase = async ({
  caseRef,
  workflowCode,
  newStatus,
  supplementaryData,
}) => {
  const kase = await findByCaseRefAndWorkflowCode(caseRef, workflowCode);

  if (!kase) {
    throw Boom.notFound(
      `Case with caseRef "${caseRef}" and workflowCode "${workflowCode}" not found`,
    );
  }
  const createdBy = getAuthenticatedUser().id;

  kase.updateStatus(newStatus, createdBy);
  kase.addDataToStage(supplementaryData);

  await update(kase);

  return kase;
};
