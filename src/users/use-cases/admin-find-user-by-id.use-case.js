import { RequiredAppRoles } from "../../cases/models/required-app-roles.js";
import { AccessControl } from "../../common/access-control.js";
import { IdpRoles } from "../models/idp-roles.js";
import { findUserByIdUseCase } from "./find-user-by-id.use-case.js";

export const adminFindUserByIdUseCase = async ({ user, userId }) => {
  AccessControl.authorise(user, {
    idpRoles: [IdpRoles.Admin],
    appRoles: RequiredAppRoles.None,
  });

  return await findUserByIdUseCase(userId);
};
