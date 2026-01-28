import { RequiredAppRoles } from "../../cases/models/required-app-roles.js";
import { AccessControl } from "../../common/access-control.js";
import { PageViewModel } from "../../common/view-models/page.view-model.js";
import { IdpRoles } from "../models/idp-roles.js";

export const adminAccessCheckUseCase = ({ user }) => {
  AccessControl.authorise(user, {
    idpRoles: [IdpRoles.Admin],
    appRoles: RequiredAppRoles.None,
  });

  return new PageViewModel({
    user,
  });
};
