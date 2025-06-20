import { ObjectId } from "mongodb";

export class UserDocument {
  constructor(props) {
    this._id = props.id
      ? ObjectId.createFromHexString(props.id)
      : new ObjectId();

    this.firstName = props.firstName;
    this.lastName = props.lastName;
    this.email = props.email;
    this.roles = props.roles;
    this.createdAt = new Date(props.createdAt);
    this.updatedAt = new Date(props.updatedAt || this.createdAt);
  }

  static createMock(props) {
    return new UserDocument({
      firstName: "John",
      lastName: "Doe",
      email: "john.doe@defra.co.uk",
      roles: {
        idp: ["FCP.Casework.Read"],
        app: ["RPA.Cases.Approve"],
      },
      createdAt: "2025-01-01T00:00:00.000Z",
      ...props,
    });
  }
}
