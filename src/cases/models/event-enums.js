export const EventEnums = {
  eventTypes: {
    CASE_CREATED: "CASE_CREATED",
    CASE_ASSIGNED: "CASE_ASSIGNED",
    CASE_UNASSIGNED: "CASE_UNASSIGNED",
    TASK_COMPLETED: "TASK_COMPLETED",
    STAGE_COMPLETED: "STAGE_COMPLETED",
    NOTE_ADDED: "NOTE_ADDED",
  },
  eventDescriptions: {
    CASE_CREATED: "Case received",
    CASE_ASSIGNED: "Case assigned",
    CASE_UNASSIGNED: "Case unassigned",
    TASK_COMPLETED: "Task completed",
    STAGE_COMPLETED: "Stage completed",
    NOTE_ADDED: "NOTE_ADDED",
  },
  noteDescriptions: {
    NOTE_ADDED: "General",
    TASK_COMPLETED: "Task",
    CASE_UNASSIGNED: "Assignment",
    CASE_ASSIGNED: "Assignment",
  },
};
