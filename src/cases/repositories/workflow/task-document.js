import { InputDocument } from "./input-document.js";
import { RequiredRolesDocument } from "./required-roles-document.js";
import { ValueOptionDocument } from "./value-option-document.js";

export class TaskDocument {
  constructor(props) {
    this.code = props.code;
    this.name = props.name;
    this.mandatory = props.mandatory;
    this.description = props.description;
    // A task has either valueOptions or input, never both. Omit the absent one
    // entirely - the driver serialises undefined as null, which fails validation
    // on read because Joi counts a null key as present for the xor rule.
    if (props.valueOptions) {
      this.valueOptions = props.valueOptions.map(
        (option) => new ValueOptionDocument(option),
      );
    }

    if (props.input) {
      this.input = new InputDocument(props.input);
    }
    this.conditional = props.conditional;
    this.comment = props.comment;
    this.requiredRoles = props.requiredRoles
      ? new RequiredRolesDocument(props.requiredRoles)
      : null;
  }
}
