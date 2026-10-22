import Boom from "@hapi/boom";
import { logger } from "../../common/logger.js";
import { updateCaseSupplementaryDataSchema } from "../models/supplementary-data-update.schema.js";
import {
  findByCaseRefAndWorkflowCode,
  SUPPLEMENTARY_DATA_CONFLICT,
  updateSupplementaryData,
} from "../repositories/case.repository.js";

const MAX_UPDATE_ATTEMPTS = 3;

const shouldRetry = (error, remainingAttempts) =>
  error.data === SUPPLEMENTARY_DATA_CONFLICT && remainingAttempts > 1;

const applyUpdate = async (instruction, remainingAttempts) => {
  const { caseRef, workflowCode, supplementaryData } = instruction;
  const kase = await findByCaseRefAndWorkflowCode(caseRef, workflowCode);
  if (!kase) {
    throw Boom.notFound(
      `Case with caseRef "${caseRef}" and workflowCode "${workflowCode}" not found`,
    );
  }
  kase.updateSupplementaryData(supplementaryData);
  try {
    await updateSupplementaryData(kase);
  } catch (error) {
    if (!shouldRetry(error, remainingAttempts)) {
      throw error;
    }
    await applyUpdate(instruction, remainingAttempts - 1);
  }
};

export const updateSupplementaryDataUseCase = async (message) => {
  const { error, value } = updateCaseSupplementaryDataSchema.validate(
    message.event?.data,
  );
  if (error) {
    throw Boom.badData(`Invalid supplementary data update: ${error.message}`);
  }
  const { caseRef, workflowCode } = value;
  logger.info(
    `Updating supplementary data for case "${caseRef}" and workflow "${workflowCode}"`,
  );
  await applyUpdate(value, MAX_UPDATE_ATTEMPTS);
  logger.info(
    `Finished: Updating supplementary data for case "${caseRef}" and workflow "${workflowCode}"`,
  );
};
