import { findNewestWorkflows } from "../../cases/repositories/workflow.repository.js";
import { logger } from "../../common/logger.js";
import { MAX_ANSWER_PATHS, answerListFrom } from "../explore/answer-paths.js";

const TTL_MINUTES = 5;
const TTL_MS = TTL_MINUTES * 60 * 1000;

let cached = null;

const readAnswerList = async () => {
  const list = answerListFrom(await findNewestWorkflows());

  if (list.cut) {
    logger.warn(`Explore answer list cut to ${MAX_ANSWER_PATHS} paths`);
  }

  cached = { at: Date.now(), ...list };

  return cached;
};

// The answers of a case Explore may read, the same list for the sources
// GAS checks against and the queries Caseworking reads. Kept 5 minutes; a
// failure never is.
export const loadAnswerListUseCase = async () =>
  cached !== null && Date.now() - cached.at < TTL_MS
    ? cached
    : readAnswerList();

export const forgetAnswerList = () => {
  cached = null;
};
