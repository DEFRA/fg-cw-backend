const EMPTY_STATE_TEXT = "There are no tasks to complete.";

const isEmptyStateParagraph = (node) =>
  node !== null &&
  typeof node === "object" &&
  node.component === "paragraph" &&
  node.text === EMPTY_STATE_TEXT;

const removeEmptyStateParagraphs = (node) => {
  let changed = false;

  if (Array.isArray(node)) {
    for (let i = node.length - 1; i >= 0; i--) {
      if (isEmptyStateParagraph(node[i])) {
        node.splice(i, 1);
        changed = true;
      } else if (removeEmptyStateParagraphs(node[i])) {
        changed = true;
      }
    }
    return changed;
  }

  if (node && typeof node === "object") {
    for (const key of Object.keys(node)) {
      if (removeEmptyStateParagraphs(node[key])) {
        changed = true;
      }
    }
  }

  return changed;
};

export const up = async (db) => {
  const workflows = await db.collection("workflows").find({}).toArray();

  for (const workflow of workflows) {
    if (removeEmptyStateParagraphs(workflow)) {
      await db
        .collection("workflows")
        .replaceOne({ _id: workflow._id }, workflow);
    }
  }
};
