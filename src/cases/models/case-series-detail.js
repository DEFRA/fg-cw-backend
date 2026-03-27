import Boom from "@hapi/boom";
import Joi from "joi";

export class CaseSeriesDetail {
  static validationSchema = Joi.object({
    caseRef: Joi.string().required(),
    dateReceived: Joi.string().required(),
    closed: Joi.boolean().required(),
    status: Joi.string().required(),
    link: Joi.object({
      text: Joi.string().required(),
      href: Joi.string().optional(),
    }).required(),
  });

  constructor(props) {
    const { error } = CaseSeriesDetail.validationSchema.validate(props, {
      stripUnknown: true,
      abortEarly: false,
    });

    if (error) {
      throw Boom.badRequest(
        `Invalid CaseSeriesDetail: ${error.details.map((d) => d.message).join(", ")}`,
      );
    }

    this.caseRef = props.caseRef;
    this.dateReceived = props.dateReceived;
    this.closed = props.closed;
    this.dateClosed = props.dateClosed;
    this.status = props.status;
    this.link = props.link;
  }

  static fromCase(caseDoc, currentCaseRef, workflow) {
    const status = workflow.getStatus(caseDoc.position);
    return new CaseSeriesDetail({
      caseRef: caseDoc.caseRef,
      dateReceived: caseDoc.createdAt,
      closed: !!caseDoc.closed,
      dateClosed: caseDoc.closedAt,
      status: status.name,
      link:
        currentCaseRef === caseDoc.caseRef
          ? { text: "This case" }
          : { href: `/cases/${caseDoc._id}/timeline`, text: "View case" },
    });
  }
}
