import { RequiredAppRoles } from "../../cases/models/required-app-roles.js";
import { AccessControl } from "../../common/access-control.js";
import { IdpRoles } from "../models/idp-roles.js";

export const adminAccessCheckUseCase = ({ user }) => {
  AccessControl.authorise(user, {
    idpRoles: [IdpRoles.Admin],
    appRoles: RequiredAppRoles.None,
  });

  return { ok: true };
};
