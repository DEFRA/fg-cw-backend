import { ObjectId } from "mongodb";
import { createWorkflowMockData } from "./workflow-mock-data.js";

export class WorkflowDocument {
  constructor(props) {
    this._id = props._id
      ? ObjectId.createFromHexString(props._id)
      : new ObjectId();

    this.code = props.code;
    this.pages = props.pages;
    this.stages = props.stages;
    this.requiredRoles = props.requiredRoles;
    this.definitions = props.definitions;
    this.externalActions = props.externalActions;
  }

  static createMock(props) {
    return new WorkflowDocument({
      ...createWorkflowMockData(),
      ...props,
    });
  }
}
