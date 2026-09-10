import { findPage } from "../repositories/inbox.repository.js";
import { config } from "../../common/config.js";
import { InboxEventRow } from "./event-rows.js";

const DECIMAL = 10;
const MAX_ATTEMPTS = Number.parseInt(
  config.get("inbox.inboxMaxRetries"),
  DECIMAL,
);

export const findInboxPageUseCase = async ({
  cursor,
  direction,
  pageSize,
  status,
  q,
  error,
  from,
  to,
  audit,
}) => {
  const page = await findPage({
    cursor,
    direction,
    pageSize,
    status,
    q,
    error,
    from,
    to,
    audit,
  });

  return {
    ...page,
    data: page.data.map((doc) => ({
      ...InboxEventRow.fromInbox(doc),
      maxAttempts: MAX_ATTEMPTS,
    })),
  };
};
