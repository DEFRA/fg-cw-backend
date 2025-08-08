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
    this.text = value.text;
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

  /**
   * Creates a comment if text is passed otherwise returns null.
   * Use to avoid having to check if comment is defined when creating objects that use comment.ref
   * @param {string} text
   * @param {EventType} type
   * @param {guid} createdById
   * @returns
   */
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

/**
 * When returning data from db we do not want to encode the text. To prevent this pass in encode: false to the constructor.
 * @param {CommentProps} props
 * @returns
 */
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
