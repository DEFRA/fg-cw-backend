import { RequiredRolesDocument } from "./required-roles-document.js";
import { StatusOptionDocument } from "./status-option-document.js";

export class TaskDocument {
  constructor(props) {
    this.code = props.code;
    this.name = props.name;
    this.type = props.type;
    this.description = props.description;
    this.statusOptions = props.statusOptions.map(
      (option) => new StatusOptionDocument(option),
    );
    this.comment = props?.comment;
    this.requiredRoles = props.requiredRoles
      ? new RequiredRolesDocument(props.requiredRoles)
      : null;
  }
}
