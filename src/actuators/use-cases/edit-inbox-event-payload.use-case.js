import {
  editPayloadById,
  findEditableById,
} from "../../cases/repositories/inbox.repository.js";
import { editEventPayloadUseCase } from "./edit-event-payload.use-case.js";

export const editInboxEventPayloadUseCase = editEventPayloadUseCase({
  box: "inbox",
  boxName: "Inbox",
  findEditableById,
  editPayloadById,
});
