import Joi from "joi";
import { ObjectId } from "mongodb";
import {
  assertInstanceOf,
  assertIsArrayOfInstances,
} from "../../common/assert.js";
import { timelineEventTypeSchema } from "../schemas/cases/timeline/event-type.schema.js";
import { idSchema } from "../schemas/id.schema.js";
import { EventEnums } from "./event-enums.js";
import { validateModel } from "./validate-model.js";

export class Comment {
  static schema = Joi.object({
    ref: idSchema,
    type: timelineEventTypeSchema.required(),
    text: Joi.string().required(),
    createdBy: Joi.string().required(),
    createdAt: Joi.string().isoDate(),
  }).label("CommentSchema");

  constructor(props) {
    const value = validateModel(props, Comment.schema);
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

  static createOptionalComment({ type, text, createdBy }) {
    if (text) {
      return new Comment({
        createdBy,
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
