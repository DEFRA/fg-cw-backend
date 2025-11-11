import { StageDocument } from "./stage-document.js";

export class PhaseDocument {
  constructor(props) {
    this.code = props.code;
    this.stages = props.stages.map((stage) => new StageDocument(stage));
  }
}
