import Boom from "@hapi/boom";
import { RequiredAppRoles } from "../../cases/models/required-app-roles.js";
import { AccessControl } from "../../common/access-control.js";
import { logger } from "../../common/logger.js";
import { IdpRoles } from "../models/idp-roles.js";
import { findByCode } from "../repositories/role.repository.js";

export const findRoleByCodeUseCase = async ({ user, code }) => {
  logger.info(`Finding role with code "${code}"`);

  AccessControl.authorise(user, {
    idpRoles: [IdpRoles.Admin],
    appRoles: RequiredAppRoles.None,
  });

  const role = await findByCode(code);

  if (!role) {
    throw Boom.notFound(`Role with code ${code} not found`);
  }

  logger.info(`Finished: Finding role by code "${code}"`);

  return role;
};
