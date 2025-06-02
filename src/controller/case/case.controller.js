import { extractListQuery } from "../../common/helpers/api/request.js";
import { publish } from "../../common/sns.js";
import { config } from "../../config.js";
import { listCasesUseCase } from "../../use-case/case/list-cases.use-case.js";
import { findCaseUseCase } from "../../use-case/case/find-case.use-case.js";
import { updateCaseStageUseCase } from "../../use-case/case/update-case-stage.use-case.js";

export const caseListController = async (request, h) => {
  const listQuery = extractListQuery(request);
  return h.response(await listCasesUseCase(listQuery));
};

export const caseDetailController = async (request, h) => {
  const {
    params: { caseId }
  } = request;
  return h.response(await findCaseUseCase(caseId));
};

export const caseStageController = async (request, h) => {
  const { caseId } = request.params;
  const caseRecord = await findCaseUseCase(caseId);

  const previousStage = caseRecord.currentStage;
  const nextStage = "contract";

  await updateCaseStageUseCase(caseId, nextStage);

  await publish(config.get("aws.caseStageUpdatedTopicArn"), {
    caseRef: caseRecord.caseRef,
    previousStage,
    currentStage: nextStage
  });

  return h.response().code(204);
};
