export class WorkflowTask {
  constructor(props) {
    this.code = props.code;
    this.name = props.name;
    this.description = props.description;
    this.type = props.type;
    this.statusOptions = props.statusOptions;
    this.requiredRoles = props.requiredRoles;
  }
}
