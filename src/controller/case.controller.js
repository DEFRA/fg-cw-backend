import Boom from "@hapi/boom";
import { randomUUID } from "crypto";
import { caseService } from "../service/case.service.js";
import { extractListQuery } from "../common/helpers/api/request.js";
import { publish } from "../common/sns.js";
import { config } from "../config.js";

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
  const { caseId } = request.params;

  const caseRecord = await caseService.getCase(caseId, request.db);
  if (!caseRecord) {
    return Boom.notFound(`Case with id: ${caseId} not found`);
  }

  const previousStage = caseRecord.currentStage;
  const nextStage = "contract";

  await caseService.updateCaseStage(caseId, nextStage, request.db);

  const event = {
    id: randomUUID(),
    source: config.get("serviceName"),
    specVersion: "1.0",
    type: `cloud.defra.${config.get("cdpEnvironment")}.${config.get("serviceName")}.case.stage.updated`,
    data: {
      caseRef: caseRecord.caseRef,
      previousStage,
      currentStage: nextStage
    }
  };

  await publish(config.get("aws.caseStageUpdatedTopicArn"), event);

  return h.response().code(204);
};
