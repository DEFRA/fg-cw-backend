import { IdpRoles } from "../users/models/idp-roles.js";

const buildNavItems = (user) => {
  const { idpRoles } = user;

  if (
    idpRoles.includes(IdpRoles.Admin) &&
    (idpRoles.includes(IdpRoles.ReadWrite) || idpRoles.includes(IdpRoles.Read))
  ) {
    return [
      {
        title: "Admin",
        href: "/admin",
      },
      {
        title: "Casework",
        href: "/cases",
      },
    ];
  }

  return [];
};

export const createPageResponse = ({ user, data }) => ({
  header: { navItems: buildNavItems(user) },
  data,
});
