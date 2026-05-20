export const up = async (db) => {
  const workflow = await db
    .collection("workflows")
    .findOne({ code: "frps-private-beta" });

  if (!workflow) {
    return;
  }

  const currentClasses =
    workflow.pages.cases.details.tabs.calculations.content[1].whenTrue.items[2]
      .classes;

  await db.collection("workflows").updateOne(
    { code: "frps-private-beta" },
    {
      $set: {
        "pages.cases.details.tabs.calculations.content.1.whenTrue.items.2.classes": `${currentClasses} no-underline`,
      },
    },
  );
};
