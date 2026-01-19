import { RequiredAppRoles } from "../../cases/models/required-app-roles.js";
import { AccessControl } from "../../common/access-control.js";
import { IdpRoles } from "../models/idp-roles.js";
import { findAll } from "../repositories/user.repository.js";

export const adminFindUsersUseCase = async ({ user, query = {} }) => {
  AccessControl.authorise(user, {
    idpRoles: [IdpRoles.Admin],
    appRoles: RequiredAppRoles.None,
  });

  return findAll(query);
};
