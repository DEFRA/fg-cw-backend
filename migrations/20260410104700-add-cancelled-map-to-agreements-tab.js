export const up = async (db) => {
  await db.collection("workflows").updateOne(
    { code: "frps-private-beta" },
    {
      $set: {
        "pages.cases.details.tabs.agreements.content.1.rows.0.text.0.themeMap":
          {
            OFFERED: "NOTICE",
            ACCEPTED: "INFO",
            AGREEMENT_GENERATING: "INFO",
            AGREEMENT_DRAFTED: "INFO",
            WITHDRAWN: "WARN",
            REJECTED: "ERROR",
            TERMINATED: "ERROR",
            CANCELLED: "WARN",
          },
        "pages.cases.details.tabs.agreements.content.1.rows.0.text.0.labelsMap":
          {
            AGREEMENT_GENERATING: "Agreement generating",
            AGREEMENT_DRAFTED: "Agreement drafted",
            OFFERED: "Offered",
            ACCEPTED: "Accepted",
            WITHDRAWN: "Withdrawn",
            REJECTED: "Rejected",
            TERMINATED: "Terminated",
            CANCELLED: "Cancelled",
          },
        "pages.cases.details.tabs.agreements.content.2.whenTrue.items.1.rows.2.themeMap":
          {
            OFFERED: "NOTICE",
            ACCEPTED: "INFO",
            AGREEMENT_GENERATING: "INFO",
            AGREEMENT_DRAFTED: "INFO",
            WITHDRAWN: "WARN",
            REJECTED: "ERROR",
            TERMINATED: "ERROR",
            CANCELLED: "WARN",
          },
        "pages.cases.details.tabs.agreements.content.2.whenTrue.items.1.rows.2.labelsMap":
          {
            AGREEMENT_GENERATING: "Agreement generating",
            AGREEMENT_DRAFTED: "Agreement drafted",
            OFFERED: "Offered",
            ACCEPTED: "Accepted",
            WITHDRAWN: "Withdrawn",
            REJECTED: "Rejected",
            TERMINATED: "Terminated",
            CANCELLED: "Cancelled",
          },
      },
    },
  );
};
