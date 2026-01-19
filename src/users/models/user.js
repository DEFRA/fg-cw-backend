import { ObjectId } from "mongodb";
import { AppRole } from "./app-role.js";
import { IdpRoles } from "./idp-roles.js";

export class User {
  constructor(props) {
    this.id = props.id || new ObjectId().toHexString();
    this.idpId = props.idpId;
    this.name = props.name;
    this.email = props.email;
    this.idpRoles = props.idpRoles || [];
    this.appRoles = props.appRoles;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.lastLoginAt = props.lastLoginAt;
  }

  setName(value) {
    this.name = value;
    this.updatedAt = new Date().toISOString();
  }

  getRoles() {
    return Object.keys(this.appRoles).filter((roleName) =>
      this.hasActiveRole(roleName),
    );
  }

  assignIdpRoles(idpRoles) {
    this.idpRoles = idpRoles;
    this.updatedAt = new Date().toISOString();
  }

  assignAppRoles(appRoles) {
    this.appRoles = appRoles;
    this.updatedAt = new Date().toISOString();
  }

  hasActiveRole(roleName) {
    const role = this.appRoles?.[roleName];
    return role?.isActive() ?? false;
  }

  hasIdpRole(roleName) {
    return this.idpRoles?.includes(roleName) ?? false;
  }

  static createMock(props) {
    return new User({
      idpId: "6a232710-1c66-4f8b-967d-41d41ae38478",
      name: "Bob Bill",
      email: "bob.bill@defra.gov.uk",
      idpRoles: [IdpRoles.ReadWrite],
      appRoles: {
        ROLE_1: new AppRole({
          name: "ROLE_1",
          startDate: "2025-07-01",
          endDate: "2100-01-01",
        }),
        ROLE_2: new AppRole({
          name: "ROLE_2",
          startDate: "2025-07-02",
          endDate: "2100-01-02",
        }),
        ROLE_3: new AppRole({
          name: "ROLE_3",
          startDate: "2025-07-03",
          endDate: "2100-01-03",
        }),
      },
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
      ...props,
    });
  }
}
