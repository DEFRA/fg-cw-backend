import { logger } from "./logger.js";

const outcomeOf = (error) => error.output?.payload?.errorCode ?? "failed";

// One line on entry, one on finishing or refusal, each naming the action. The
// refusal names its code alone: an error's message may quote a hash.
export const loggedAction = async (action, work) => {
  logger.info(action);

  try {
    const result = await work();

    logger.info(`Finished: ${action}`);

    return result;
  } catch (error) {
    logger.warn(`Refused: ${action} - ${outcomeOf(error)}`);

    throw error;
  }
};
