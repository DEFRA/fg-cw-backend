import { logger } from "../../common/logger.js";
import { updateSupplementaryDataUseCase } from "./update-supplementary-data.use-case.js";

export const handleAgreementStatusUpdateUseCase = async (message) => {
  const {
    event: { data },
  } = message;
  if (data?.supplementaryData) {
    await updateSupplementaryDataUseCase(data);
    logger.info(
      `Updated case status with caseRef "${data.caseRef}" and workflowCode "${data.workflowCode}"`,
    );
  }
};
