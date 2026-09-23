import {
  editPayloadById,
  findEditableById,
} from "../../cases/repositories/outbox.repository.js";
import { editEventPayloadUseCase } from "./edit-event-payload.use-case.js";

export const editOutboxEventPayloadUseCase = editEventPayloadUseCase({
  box: "outbox",
  boxName: "Outbox",
  findEditableById,
  editPayloadById,
});
