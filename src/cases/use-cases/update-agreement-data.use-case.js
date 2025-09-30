import Boom from "@hapi/boom";
import {
  findByCaseRefAndWorkflowCode,
  update,
} from "../repositories/case.repository.js";

export const updateAgreementDataUseCase = async ({
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
  const agreements = kase.supplementaryData.agreements || [];
  agreements.push(data);
  kase.addSupplementaryData(targetNode, agreements);

  await update(kase);

  return kase;
};
