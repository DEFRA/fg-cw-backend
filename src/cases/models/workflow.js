import { ObjectId } from "mongodb";
import { createWorkflowMockData } from "./workflow-mock-data.js";

export class Workflow {
  constructor(props) {
    this._id = props._id || new ObjectId().toHexString();
    this.code = props.code;
    this.pages = props.pages;
    this.stages = props.stages;
    this.requiredRoles = props.requiredRoles;
  }

  static createMock(props) {
    return new Workflow({
      ...createWorkflowMockData(),
      ...props,
    });
  }
}
