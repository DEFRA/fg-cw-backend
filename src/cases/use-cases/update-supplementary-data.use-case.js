import Boom from "@hapi/boom";
import {
  findByCaseRefAndWorkflowCode,
  update,
} from "../repositories/case.repository.js";

export const updateSupplementaryDataUseCase = async ({
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

  kase.updateStatus(newStatus, null);

  const { targetNode, data } = supplementaryData;

  kase.addSupplementaryData(targetNode, data);

  await update(kase);

  return kase;
};
