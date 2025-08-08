import Boom from "@hapi/boom";
import Joi from "joi";
import { ObjectId } from "mongodb";
import {
  assertInstanceOf,
  assertIsArrayOfInstances,
} from "../../common/assert.js";
import { idSchema } from "../schemas/id.schema.js";
import { EventEnums } from "./event-enums.js";

export class Comment {
  static validationSchema = Joi.object({
    ref: idSchema,
    type: Joi.string().required(),
    text: Joi.string().required(),
    createdBy: Joi.string().required(),
    createdAt: Joi.string().isoDate(),
  });

  constructor(props) {
    const { error, value } = Comment.validationSchema.validate(props, {
      stripUnknown: true,
      abortEarly: false,
    });

    if (error) {
      throw Boom.badRequest(
        `Invalid Comment: ${error.details.map((d) => d.message).join(", ")}`,
      );
    }

    this.ref = value.ref || new ObjectId().toHexString();
    this.type = value.type;
    this.text = encodeURIComponent(value.text);
    this.createdBy = value.createdBy;
    this.createdAt = value.createdAt || new Date().toISOString();
  }

  getUserIds() {
    return [this.createdBy];
  }

  get title() {
    const title = EventEnums.noteDescriptions[this.type];
    return title || EventEnums.noteDescriptions.NOTE_ADDED;
  }

  static createMock(props) {
    return new Comment(props);
  }

  // returns a comment or null if text is empty
  static createOptionalComment(text, type, createdById) {
    if (text) {
      return new Comment({
        createdBy: createdById,
        type,
        text,
      });
    } else {
      return null;
    }
  }
}

export const toComment = (props) => {
  return new Comment(props);
};

export const toComments = (props) => {
  return props?.map(toComment) || [];
};

export const assertIsComment = (obj) => {
  return assertInstanceOf(obj, Comment, "Comment");
};

export const assertIsCommentsArray = (arr) => {
  return assertIsArrayOfInstances(arr, Comment, "Comment");
};
