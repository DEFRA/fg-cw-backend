import { ObjectId } from "mongodb";

export class UserDocument {
  constructor(props) {
    this._id = props.id
      ? ObjectId.createFromHexString(props.id)
      : new ObjectId();

    this.idpId = props.idpId;
    this.name = props.name;
    this.email = props.email;
    this.idpRoles = props.idpRoles;
    this.appRoles = props.appRoles;
    this.createdAt = new Date(props.createdAt);
    this.updatedAt = new Date(props.updatedAt);
  }

  static createMock(props) {
    return new UserDocument({
      idpId: "6a232710-1c66-4f8b-967d-41d41ae38478",
      name: "Bob Bill",
      email: "bob.bill@defra.gov.uk",
      idpRoles: ["FCP.Casework.ReadWrite"],
      appRoles: ["ROLE_RPA_CASES_APPROVE"],
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
      ...props,
    });
  }
}
