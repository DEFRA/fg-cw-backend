import Joi from "joi";
import { validateModel } from "./validate-model.js";

export class Outcome {
  static schema = Joi.object({
    actionId: Joi.string().required(),
    commentRef: Joi.string().optional(),
    createdBy: Joi.string().required(),
    createdAt: Joi.string().isoDate().optional(),
  }).label("CommentSchema");

  constructor(props) {
    const value = validateModel(props, Outcome.schema);
    this.actionId = value.actionId;
    this.commentRef = value.commentRef;
    this.createdBy = value.createdBy;
    this.createdAt = value.createdAt || new Date().toISOString();
  }
}
