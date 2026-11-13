import Joi from "joi";
import { binSchema } from "../../common/buckets/schema.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const DAYS_PER_WEEK = 7;

// A week of two-hour bins at most, so one read stays bounded.
export const MAX_WINDOW_MS = DAYS_PER_WEEK * DAY_MS;

const isoDate = Joi.string().isoDate().required();

export const deadLettersQuerySchema = Joi.object({
  from: isoDate,
  to: isoDate,
}).label("DeadLettersQuery");

export const deadLettersResponseSchema = Joi.object({
  from: isoDate,
  to: isoDate,
  countCap: Joi.number().integer().min(1).required(),
  buckets: Joi.array()
    .items(
      Joi.object({
        id: Joi.string().required(),
        list: Joi.object({
          path: Joi.string().required(),
          query: Joi.object().pattern(Joi.string(), Joi.string()).required(),
        }).required(),
        bins: Joi.array().items(binSchema).required(),
      }),
    )
    .required(),
}).label("DeadLettersResponse");
