import { Payload } from "./case-payload-model.js";

export class CaseModel {
  constructor({ _id, caseRef, workflowCode, payload, stages }, options = {}) {
    this._id = _id || undefined;
    this.caseRef = caseRef;
    this.workflowCode = workflowCode;
    this.payload = new Payload(payload);
    this.stages = stages;
    this.status = options.status || undefined;
    this.dateReceived = options.dateReceived || undefined;
  }

  static newCase(data) {
    return new CaseModel(data, {
      status: "NEW",
      dateReceived: new Date().toISOString()
    });
  }

  static existingCase(data) {
    return new CaseModel(data);
  }
}
