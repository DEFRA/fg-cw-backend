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

  const { targetNode, data, key, dataType } = supplementaryData;

  kase.updateSupplementaryData({
    targetNode,
    data,
    dataType,
    key,
  });

  await update(kase);

  return kase;
};
