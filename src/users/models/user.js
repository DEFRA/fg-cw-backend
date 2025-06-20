import { ObjectId } from "mongodb";

export class User {
  constructor(props) {
    this.id = props.id || new ObjectId().toHexString();
    this.firstName = props.firstName;
    this.lastName = props.lastName;
    this.email = props.email;
    this.createdAt = props.createdAt || new Date().toISOString();
    this.updatedAt = props.updatedAt || this.createdAt;
    this.roles = props.roles;
  }

  static createMock(props) {
    return new User({
      firstName: "John",
      lastName: "Doe",
      email: "john.doe@defra.co.uk",
      roles: {
        idp: ["FCP.Casework.Read"],
        app: ["RPA.Cases.Approve"],
      },
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
      ...props,
    });
  }
}
