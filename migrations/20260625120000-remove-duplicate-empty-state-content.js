const EMPTY_STATE_TEXTS = new Set([
  "There are no tasks to complete.",
  "There is nothing more you need to do.",
  "The agreement has been offered and you don't need to do anything else.",
]);
const stageHasTasks = (stage) =>
  (stage.taskGroups ?? []).some((group) => (group.tasks ?? []).length > 0);
const removeEmptyStateMessaging = (node) => {
  let changed = false;
  if (Array.isArray(node)) {
    for (let i = node.length - 1; i >= 0; i--) {
      const item = node[i];
      if (item?.text && EMPTY_STATE_TEXTS.has(item.text)) {
        if (item.component === "paragraph") {
          node.splice(i, 1);
          changed = true;
          continue;
        }
        delete item.text;
        changed = true;
      }
      if (removeEmptyStateMessaging(item)) {
        changed = true;
      }
    }
  } else if (node && typeof node === "object") {
    for (const value of Object.values(node)) {
      if (removeEmptyStateMessaging(value)) {
        changed = true;
      }
    }
  }
  return changed;
};
export const up = async (db) => {
  const workflows = await db.collection("workflows").find({}).toArray();
  for (const workflow of workflows) {
    let changed = false;
    for (const phase of workflow.phases ?? []) {
      for (const stage of phase.stages ?? []) {
        if (
          !stageHasTasks(stage) &&
          removeEmptyStateMessaging(stage.beforeContent)
        ) {
          changed = true;
        }
      }
    }
    if (changed) {
      await db
        .collection("workflows")
        .replaceOne({ _id: workflow._id }, workflow);
    }
  }
};
