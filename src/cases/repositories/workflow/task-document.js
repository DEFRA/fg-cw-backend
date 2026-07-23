import { RequiredRolesDocument } from "./required-roles-document.js";
import { ValueOptionDocument } from "./value-option-document.js";

export class TaskDocument {
  constructor(props) {
    this.code = props.code;
    this.name = props.name;
    this.mandatory = props.mandatory;
    this.description = props.description;
    this.valueOptions = props.valueOptions.map(
      (option) => new ValueOptionDocument(option),
    );
    this.comment = props?.comment;
    this.requiredRoles = props.requiredRoles
      ? new RequiredRolesDocument(props.requiredRoles)
      : null;
  }
}
