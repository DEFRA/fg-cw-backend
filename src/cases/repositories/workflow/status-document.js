import { TransitionDocument } from "./transition-document.js";

export class StatusDocument {
  constructor(props) {
    this.closes = props.closes;
    this.code = props.code;
    this.name = props.name;
    this.theme = props.theme;
    this.description = props.description;
    this.interactive = props.interactive;
    this.hideTaskGroups = props.hideTaskGroups || false;
    this.transitions = props.transitions.map((t) => new TransitionDocument(t));
  }
}
