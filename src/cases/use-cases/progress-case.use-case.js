import Boom from "@hapi/boom";
import { logger } from "../../common/logger.js";
import { Position } from "../models/position.js";
import {
  findByCaseRefAndWorkflowCode,
  update,
} from "../repositories/case.repository.js";
import { ensureCasePosition } from "./ensure-case-position.use-case.js";
import { findWorkflowByCodeUseCase } from "./find-workflow-by-code.use-case.js";

export const progressCaseUseCase = async ({
  caseRef,
  workflowCode,
  newStatus,
  supplementaryData,
}) => {
  logger.info(
    `Progressing case with caseRef "${caseRef}" and workflowCode "${workflowCode}" to position "${newStatus}"`,
  );

  const kase = await findByCaseRefAndWorkflowCode(caseRef, workflowCode);

  if (!kase) {
    throw Boom.notFound(
      `Case with caseRef "${caseRef}" and workflowCode "${workflowCode}" not found`,
    );
  }

  const workflow = await findWorkflowByCodeUseCase(kase.workflowCode);

  const targetPosition = Position.from(newStatus);
  await ensureCasePosition(kase, workflow, targetPosition);

  kase.progressTo({
    position: targetPosition,
    workflow,
    createdBy: "System",
  });

  if (supplementaryData) {
    const { targetNode, data, key, dataType } = supplementaryData;

    logger.info(
      `Attaching supplementary data to ${targetNode}[${key}]. Data type is ${dataType}`,
    );

    kase.updateSupplementaryData({
      targetNode,
      data,
      dataType,
      key,
    });
  }

  await update(kase);

  logger.info(
    `Finished: Progressing case with caseRef "${caseRef}" and workflowCode "${workflowCode}" to position "${newStatus}"`,
  );

  return kase;
};
