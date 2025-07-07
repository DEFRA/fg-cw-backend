import { ObjectId } from "mongodb";

export class RoleDocument {
  constructor(props) {
    this._id = props.id
      ? ObjectId.createFromHexString(props.id)
      : new ObjectId();

    this.code = props.code;
    this.description = props.description;
    this.createdAt = new Date(props.createdAt);
    this.updatedAt = new Date(props.updatedAt);
  }

  static createMock(props) {
    return new RoleDocument({
      code: "ROLE_RPA_CASES_APPROVE",
      description: "Approve case applications",
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
      ...props,
    });
  }
}
