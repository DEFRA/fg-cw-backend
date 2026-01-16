import { AccessControl } from "../../cases/models/access-control.js";
import { RequiredAppRoles } from "../../cases/models/required-app-roles.js";
import { logger } from "../../common/logger.js";
import { IdpRoles } from "../models/idp-roles.js";
import { Role } from "../models/role.js";
import { save } from "../repositories/role.repository.js";

export const createRoleUseCase = async ({
  user,
  code,
  description,
  assignable,
}) => {
  AccessControl.authorise(user, {
    idpRoles: [IdpRoles.Admin],
    appRoles: RequiredAppRoles.None,
  });

  logger.info(`Creating role: "${code}"`);

  const createdAt = new Date().toISOString();
  const role = new Role({
    code,
    description,
    assignable,
    createdAt,
    updatedAt: createdAt,
  });

  await save(role);

  logger.info(`Finished: Creating role: "${role.code}"`);

  return role;
};
