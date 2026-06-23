export const up = async (db) => {
  const workflow = await db
    .collection("workflows")
    .findOne({ code: "woodland" });

  if (workflow) {
    let workflowUpdated = false;

    const updateCommentLabel = (comment) => {
      if (comment && comment.label === "") {
        comment.label = {
          text: "Comment",
          classes: "govuk-visually-hidden",
        };
        return true;
      }
      return false;
    };

    workflow.phases?.forEach((phase) => {
      phase.stages?.forEach((stage) => {
        // Update stage status transitions
        stage.statuses?.forEach((status) => {
          status.transitions?.forEach((transition) => {
            if (updateCommentLabel(transition.action?.comment)) {
              workflowUpdated = true;
            }
          });
        });

        // Update task status options
        stage.taskGroups?.forEach((group) => {
          group.tasks?.forEach((task) => {
            task.statusOptions?.forEach((option) => {
              if (updateCommentLabel(option.comment)) {
                workflowUpdated = true;
              }
            });
          });
        });
      });
    });

    if (workflowUpdated) {
      await db
        .collection("workflows")
        .replaceOne({ _id: workflow._id }, workflow);
    }
  }
};
