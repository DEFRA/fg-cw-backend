import { ObjectId } from "mongodb";
import { UserRole } from "./userRole.js";

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
  }

  createAppRole(appRoles) {
    const result = {};

    for (const [name, roleData] of Object.entries(appRoles)) {
      result[name] = new UserRole({
        name,
        startDate: roleData.startDate,
        endDate: roleData.endDate,
      });
    }

    return result;
  }

  static createMock(props) {
    return new User({
      idpId: "6a232710-1c66-4f8b-967d-41d41ae38478",
      name: "Bob Bill",
      email: "bob.bill@defra.gov.uk",
      idpRoles: ["FCP.Casework.ReadWrite"],
      appRoles: {
        ROLE_RPA_CASES_APPROVE: new UserRole({
          name: "ROLE_RPA_CASES_APPROVE",
          startDate: "2025-07-01",
          endDate: "2025-08-02",
        }),
      },
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
      ...props,
    });
  }
}
