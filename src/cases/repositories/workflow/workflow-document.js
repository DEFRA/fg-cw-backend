import { ObjectId } from "mongodb";
import { createPagesMock } from "../../models/create-pages-mock.js";
import { PhaseDocument } from "./phase-document.js";
import { RequiredRolesDocument } from "./required-roles-document.js";

export class WorkflowDocument {
  constructor(props) {
    this._id = props._id
      ? ObjectId.createFromHexString(props._id)
      : new ObjectId();

    this.code = props.code;
    this.pages = props.pages;
    this.phases = props.phases.map((phase) => new PhaseDocument(phase));
    this.requiredRoles = new RequiredRolesDocument(props.requiredRoles);
    this.definitions = props.definitions;

    // Only include externalActions if it's defined and not null
    if (props.externalActions !== null && props.externalActions !== undefined) {
      this.externalActions = props.externalActions;
    }
  }

  static createMock(props) {
    return new WorkflowDocument({
      code: "workflow-code",
      pages: createPagesMock(),
      phases: [PhaseDocument.createMock()],
      requiredRoles: {
        allOf: ["ROLE_1", "ROLE_2"],
        anyOf: ["ROLE_3"],
      },
      definitions: {
        key1: "value1",
      },
      externalActions: [
        {
          code: "RERUN_RULES",
          name: "Rerun Rules",
          description: "Rerun the business rules validation",
          endpoint: "landGrantsRulesRerun",
          target: {
            position: "PRE_AWARD:REVIEW_APPLICATION:IN_PROGRESS",
            node: "landGrantsRulesRun",
            nodeType: "array",
            place: "append",
          },
        },
      ],
      ...props,
    });
  }
}
