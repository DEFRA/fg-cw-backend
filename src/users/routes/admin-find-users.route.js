import Joi from "joi";

import { createPageResponse } from "../../common/create-page-response.js";
import { codeSchema } from "../../common/schemas/roles/code.schema.js";
import { idSchema } from "../../common/schemas/user/id.schema.js";
import { idpIdSchema } from "../schemas/user/idp-id.schema.js";
import { adminFindUsersUseCase } from "../use-cases/admin-find-users.use-case.js";

export const adminFindUsersRoute = {
  method: "GET",
  path: "/admin/users",
  options: {
    description: "Find all users (admin only)",
    tags: ["api"],
    validate: {
      query: Joi.object({
        idpId: idpIdSchema,
        ids: Joi.array().items(idSchema).single().default([]),
        allAppRoles: Joi.array().items(codeSchema).single().default([]),
        anyAppRoles: Joi.array().items(codeSchema).single().default([]),
      }),
    },
  },
  async handler(request) {
    const { user } = request.auth.credentials;

    const data = await adminFindUsersUseCase({
      user,
      query: {
        idpId: request.query.idpId,
        ids: request.query.ids,
        allAppRoles: request.query.allAppRoles,
        anyAppRoles: request.query.anyAppRoles,
      },
    });

    return createPageResponse({ user, data });
  },
};
