// FGP-1182: Fix spelling mistakes in the woodland (WMP) workflow content.
//   1. Start screen paragraph: "being working" -> "begin working"
//   2. "Notify customer that draft agreement is ready" task, "Could not send
//      to customer" outcome explanation help text: "could not been sent" ->
//      "could not be sent"
//
// Case documents do not embed workflow content (it is read live from the
// "workflows" collection at render time), so only the workflow needs updating.

const WORKFLOW_CODE = "woodland";

const TEXT_FIXES = [
  {
    from: "Select 'Start' to being working on this application.",
    to: "Select 'Start' to begin working on this application.",
  },
  {
    from: "Explain why the draft agreement link could not been sent.",
    to: "Explain why the draft agreement link could not be sent.",
  },
];

// Recursively walk the workflow definition and apply the exact-string fixes.
// Returns true if any value was changed.
const applyTextFixes = (node) => {
  let changed = false;

  if (Array.isArray(node)) {
    node.forEach((item) => {
      if (applyTextFixes(item)) {
        changed = true;
      }
    });
    return changed;
  }

  if (node && typeof node === "object") {
    for (const key of Object.keys(node)) {
      const value = node[key];

      if (typeof value === "string") {
        const fix = TEXT_FIXES.find((candidate) => candidate.from === value);
        if (fix) {
          node[key] = fix.to;
          changed = true;
        }
      } else if (value && typeof value === "object") {
        if (applyTextFixes(value)) {
          changed = true;
        }
      }
    }
  }

  return changed;
};

export const up = async (db) => {
  const workflow = await db
    .collection("workflows")
    .findOne({ code: WORKFLOW_CODE });

  if (!workflow) {
    return;
  }

  if (applyTextFixes(workflow)) {
    await db
      .collection("workflows")
      .replaceOne({ _id: workflow._id }, workflow);
  }
};
