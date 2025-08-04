import Boom from "@hapi/boom";
import Joi from "joi";
import { ObjectId } from "mongodb";

export class Note {
  static validationSchema = Joi.object({
    id: Joi.string(),
    createdAt: Joi.string(),
    createdBy: Joi.string().required(),
    type: Joi.string().required(),
    content: Joi.string().required(),
  });

  constructor(props) {
    const { error, value } = Note.validationSchema.validate(props, {
      stripUnknown: true,
      abortEarly: false,
    });

    if (error) {
      throw Boom.badRequest(
        `Invalid Note: ${error.details.map((d) => d.message).join(", ")}`,
      );
    }

    this.id = value.id ? value.id : new ObjectId().toHexString();
    this.createdAt = value.createdAt
      ? value.createdAt
      : new Date().toISOString();
    this.createdBy = value.createdBy;
    this.type = value.type;
    this.content = value.content;
  }
}
