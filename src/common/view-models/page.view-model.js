import { IdpRoles } from "../../users/models/idp-roles.js";

export class PageViewModel {
  constructor({ user, data }) {
    const navItems = [];

    if (user.idpRoles.includes(IdpRoles.Admin)) {
      navItems.push({
        title: "Admin",
        href: "/admin",
      });
    }

    if (user.idpRoles.includes(IdpRoles.ReadWrite)) {
      navItems.push({
        title: "Casework",
        href: "/cases",
      });
    }

    this.header = {
      navItems,
    };

    this.data = data;
  }
}
