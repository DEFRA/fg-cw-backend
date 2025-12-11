/**
 * Migration: Update workflow status components to use theme colours instead of direct CSS classes
 *
 * This migration replaces classesMap with themeMap in status components within the FRPS workflow pages.
 *
 * Changes:
 * - Calculations tab: Rules validation status (Yes/No) uses SUCCESS/ERROR themes
 * - Agreements tab: Agreement status uses semantic themes (NOTICE, INFO, NEUTRAL)
 */

export const up = async (db) => {
  await db.collection("workflows").updateOne(
    { code: "frps-private-beta" },
    {
      $set: {
        // Calculations tab - rules validation status
        "pages.cases.details.tabs.calculations.content.1.whenTrue.items.1.items.0.rows.1.themeMap":
          {
            Yes: "SUCCESS",
            No: "ERROR",
          },

        // Agreements tab - summary list status
        "pages.cases.details.tabs.agreements.content.1.rows.0.text.0.themeMap":
          {
            OFFERED: "NOTICE",
            ACCEPTED: "INFO",
            AGREEMENT_DRAFTED: "INFO",
            AGREEMENT_GENERATING: "INFO",
            WITHDRAWN: "NEUTRAL",
            REJECTED: "NEUTRAL",
          },

        // Agreements tab - version history table status
        "pages.cases.details.tabs.agreements.content.2.whenTrue.items.1.rows.2.themeMap":
          {
            OFFERED: "NOTICE",
            ACCEPTED: "INFO",
            AGREEMENT_DRAFTED: "INFO",
            AGREEMENT_GENERATING: "INFO",
            WITHDRAWN: "NEUTRAL",
            REJECTED: "NEUTRAL",
          },
      },
      $unset: {
        // Remove old classesMap properties
        "pages.cases.details.tabs.calculations.content.1.whenTrue.items.1.items.0.rows.1.classesMap":
          "",
        "pages.cases.details.tabs.agreements.content.1.rows.0.text.0.classesMap":
          "",
        "pages.cases.details.tabs.agreements.content.2.whenTrue.items.1.rows.2.classesMap":
          "",
      },
    },
  );
};
