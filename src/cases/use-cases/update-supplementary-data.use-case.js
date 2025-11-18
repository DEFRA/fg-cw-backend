import Boom from "@hapi/boom";
import { Position } from "../models/position.js";
import {
  findByCaseRefAndWorkflowCode,
  update,
} from "../repositories/case.repository.js";
import { findWorkflowByCodeUseCase } from "./find-workflow-by-code.use-case.js";

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
  const workflow = await findWorkflowByCodeUseCase(kase.workflowCode);

  kase.progressTo({
    position: Position.from(newStatus),
    workflow,
    createdBy: "System",
  });

  kase.updateSupplementaryData({
    targetNode,
    data,
    dataType,
    key,
  });

  await update(kase);

  return kase;
};
