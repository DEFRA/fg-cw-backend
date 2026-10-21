import { readTimeline } from "../../common/buckets/engine.js";
import { logger } from "../../common/logger.js";

// Not audited here: the caller's record page audits the operator's view.
export const readTimelineUseCase = ({ ref }) => {
  logger.info("Read record timeline");

  return readTimeline(ref);
};
