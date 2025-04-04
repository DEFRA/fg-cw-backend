import Boom from "@hapi/boom";
import { caseService } from "../service/case.service.js";

export const caseCreateController = async (request, h) => {
  return h
    .response(await caseService.createCase(request.payload, request.db))
    .code(201);
};

export const caseListController = async (request, h) => {
  const results = await caseService.findCases(request.db);
  return h.response(results);
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
