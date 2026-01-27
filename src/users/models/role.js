import { ObjectId } from "mongodb";

export class Role {
  constructor(props) {
    this.id = props.id || new ObjectId().toHexString();
    this.code = props.code;
    this.description = props.description;
    this.assignable = props.assignable;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  static createMock(props) {
    return new Role({
      code: "ROLE_RPA_CASES_APPROVE",
      description: "Approve case applications",
      assignable: true,
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
      ...props,
    });
  }
}
