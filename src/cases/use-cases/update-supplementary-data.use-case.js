import Boom from "@hapi/boom";
import { logger } from "../../common/logger.js";
import { updateCaseSupplementaryDataSchema } from "../models/supplementary-data-update.schema.js";
import {
  findByCaseRefAndWorkflowCode,
  updateSupplementaryData,
} from "../repositories/case.repository.js";

export const updateSupplementaryDataUseCase = async (message) => {
  const { error, value } = updateCaseSupplementaryDataSchema.validate(
    message.event?.data,
  );
  if (error) {
    throw Boom.badData(`Invalid supplementary data update: ${error.message}`);
  }
  const { caseRef, workflowCode, supplementaryData } = value;
  logger.info(
    `Updating supplementary data for case "${caseRef}" and workflow "${workflowCode}"`,
  );
  const kase = await findByCaseRefAndWorkflowCode(caseRef, workflowCode);
  if (!kase) {
    throw Boom.notFound(
      `Case with caseRef "${caseRef}" and workflowCode "${workflowCode}" not found`,
    );
  }
  kase.updateSupplementaryData(supplementaryData);
  await updateSupplementaryData(kase);
  logger.info(
    `Finished: Updating supplementary data for case "${caseRef}" and workflow "${workflowCode}"`,
  );
};
