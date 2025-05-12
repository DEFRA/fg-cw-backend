import Boom from "@hapi/boom";
import { caseService } from "../service/case.service.js";
import { extractListQuery } from "../common/helpers/api/request.js";
import { publishEvent } from "../utils/eventPublisher.js";

export const caseCreateController = async (request, h) => {
  return h
    .response(await caseService.createCase(request.payload, request.db))
    .code(201);
};

export const caseListController = async (request, h) => {
  const listQuery = extractListQuery(request);
  const results = await caseService.findCases(listQuery, request.db);
  try {
    return h.response(results);
  } catch (e) {
    console.log(e);
  }
};

export const caseDetailController = async (request, h) => {
  const result = await caseService.getCase(request.params.caseId, request.db);
  if (!result) {
    return Boom.notFound(
      "Case with id: " + request.params.caseId + " not found"
    );
  }
  return h.response(result);
};

export const caseStageController = async (request, h) => {
  const { nextStage } = request.payload;
  const { caseId } = request.params;

  const caseRecord = await caseService.getCase(caseId, request.db);
  if (!caseRecord) {
    return Boom.notFound(`Case with id: ${caseId} not found`);
  }

  const previousStage = caseRecord.currentStage;

  const allMandatoryTasksComplete = await caseService.areMandatoryTasksComplete(
    caseId,
    request.db
  );
  if (!allMandatoryTasksComplete) {
    return Boom.badRequest(
      "Not all mandatory tasks in the current stage are complete."
    );
  }

  const updatedCase = await caseService.updateCaseStage(
    caseId,
    nextStage,
    request.db
  );

  await publishEvent("case_stage_updated", {
    caseId,
    applicationId: caseRecord.applicationId,
    previousStage,
    newCurrentStage: nextStage
  });

  return h.response(updatedCase).code(200);
};
