import { caseService } from "../service/case.service.js";

export const eventController = async (request, h) => {
  return h
    .response(
      await caseService.handleCreateCaseEvent(request.payload, request.db)
    )
    .code(201);
};
