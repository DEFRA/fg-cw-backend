import { RequiredAppRoles } from "../../cases/models/required-app-roles.js";
import { AccessControl } from "../../common/access-control.js";
import { IdpRoles } from "../models/idp-roles.js";
import { findAll } from "../repositories/role.repository.js";

export const findRolesUseCase = async ({ user }) => {
  AccessControl.authorise(user, {
    idpRoles: [IdpRoles.Admin],
    appRoles: RequiredAppRoles.None,
  });

  return await findAll();
};
