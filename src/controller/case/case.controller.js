import Boom from "@hapi/boom";
import { caseService } from "../../service/case.service.js";
import { extractListQuery } from "../../common/helpers/api/request.js";
import { publish } from "../../common/sns.js";
import { config } from "../../config.js";

export const caseCreateController = async (request, h) => {
  return h.response(await caseService.createCase(request.payload)).code(201);
};

export const caseListController = async (request, h) => {
  const listQuery = extractListQuery(request);
  const results = await caseService.findCases(listQuery);
  try {
    return h.response(results);
  } catch (e) {
    console.log(e);
  }
};

export const caseDetailController = async (request, h) => {
  const result = await caseService.getCase(request.params.caseId);
  if (!result) {
    return Boom.notFound(
      "Case with id: " + request.params.caseId + " not found"
    );
  }
  return h.response(result);
};

export const caseStageController = async (request, h) => {
  const { caseId } = request.params;

  const caseRecord = await caseService.getCase(caseId);
  if (!caseRecord) {
    return Boom.notFound(`Case with id: ${caseId} not found`);
  }

  const previousStage = caseRecord.currentStage;
  const nextStage = "contract";

  await caseService.updateCaseStage(caseId, nextStage);

  await publish(config.get("aws.caseStageUpdatedTopicArn"), {
    caseRef: caseRecord.caseRef,
    previousStage,
    currentStage: nextStage
  });

  return h.response().code(204);
};
