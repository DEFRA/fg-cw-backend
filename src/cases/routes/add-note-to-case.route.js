import Joi from "joi";
import { logger } from "../../common/logger.js";
import { HttpCodes } from "../../common/schemas/http-codes.js";
import { ValidationError } from "../schemas/common.schema.js";
import { idSchema } from "../schemas/id.schema.js";
import { addNoteToCaseRequestSchema } from "../schemas/requests/add-note-to-case-request.schema.js";
import { addNoteToCaseUseCase } from "../use-cases/add-note-to-case.use-case.js";

export const addNoteToCaseRoute = {
  method: "POST",
  path: "/cases/{caseId}/notes",
  options: {
    description: "Add a note to a case",
    tags: ["api"],
    validate: {
      params: Joi.object({
        caseId: idSchema.required(),
      }),
      payload: addNoteToCaseRequestSchema,
    },
    response: {
      status: {
        [HttpCodes.BadRequest]: ValidationError,
        [HttpCodes.Created]: Joi.object({
          caseId: idSchema.required(),
          noteRef: idSchema.required(),
        }),
      },
    },
  },
  async handler(request, h) {
    const { caseId } = request.params;
    const { text } = request.payload;
    const { user } = request.auth.credentials;

    logger.info(`Adding note to case ${caseId}`);

    const note = await addNoteToCaseUseCase({
      caseId,
      text,
      user,
    });

    logger.info(`Added note ${note.ref} to case ${caseId}`);

    return h
      .response({
        caseId,
        noteRef: note.ref,
      })
      .code(HttpCodes.Created);
  },
};
