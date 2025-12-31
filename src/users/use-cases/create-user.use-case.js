import { AccessControl } from "../../cases/models/access-control.js";
import { RequiredAppRoles } from "../../cases/models/required-app-roles.js";
import { logger } from "../../common/logger.js";
import { AppRole } from "../models/app-role.js";
import { IdpRoles } from "../models/idp-roles.js";
import { User } from "../models/user.js";
import { save } from "../repositories/user.repository.js";

export const createUserUseCase = async (props) => {
  const { user: authenticatedUser } = props;

  AccessControl.authorise(authenticatedUser, {
    idpRoles: [IdpRoles.Admin],
    appRoles: RequiredAppRoles.None,
  });

  const createdAt = new Date().toISOString();

  logger.info(`Creating user: ${props.name}`);

  const appRoles = Object.entries(props.appRoles).reduce(
    (acc, [code, value]) => {
      acc[code] = new AppRole(value);
      return acc;
    },
    {},
  );

  const user = new User({
    idpId: props.idpId,
    name: props.name,
    email: props.email,
    idpRoles: props.idpRoles,
    appRoles,
    createdAt,
    updatedAt: createdAt,
  });

  await save(user);

  logger.info(`Finished: Creating user: ${user.id}`);
  return user;
};
