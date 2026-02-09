import Boom from "@hapi/boom";
import { RequiredAppRoles } from "../../cases/models/required-app-roles.js";
import { AccessControl } from "../../common/access-control.js";
import { logger } from "../../common/logger.js";
import { IdpRoles } from "../models/idp-roles.js";
import { findByCode, update } from "../repositories/role.repository.js";

export const updateRoleUseCase = async ({
  user,
  code,
  description,
  assignable,
}) => {
  logger.info(`Updating role: "${code}"`);

  AccessControl.authorise(user, {
    idpRoles: [IdpRoles.Admin],
    appRoles: RequiredAppRoles.None,
  });

  const role = await findByCode(code);

  if (!role) {
    throw Boom.notFound(`Role with code ${code} not found`);
  }

  role.description = description;
  role.assignable = assignable;
  role.updatedAt = new Date().toISOString();

  await update(role);

  logger.info(`Finished: Updating role: "${code}"`);

  return role;
};
