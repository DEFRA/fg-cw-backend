import { withTransaction } from "../src/common/with-transaction.js";

export const up = async (db, client) => {
  const refs = {
    106241643: "2326337",
    106323196: "2348574",
    106490576: "2305310",
    106553297: "2342972",
    106634181: "2337697",
    106668514: "2338801",
    106692400: "2338146",
    106776150: "2298162",
    106933321: "2295123",
    106969836: "2341558",
    107006764: "2320439",
    107059405: "2339149",
    107082687: "2314222",
    107124756: "2286716",
    107138876: "2315984",
    110192152: "2338513",
    110327815: "2332924",
    110545261: "2337012",
    114352085: "2342146",
    116623145: "2323988",
    117570918: "2265948",
    117571851: "2265872",
    122259669: "2337691",
    200008255: "2337285",
    200105772: "2328369",
    200628182: "2334316",
    200922657: "2342831",
    200927219: "2286938",
    201109197: "2244737",
    201115195: "2338603",
    201117357: "2263459",
    201127086: "2283622",
    201127543: "2286784",
    201128065: "2297777",
    201130003: "2291951",
    201141756: "2318913",
    201145088: "2341576",
  };

  const task = {
    code: "TASK_SITI_REFERENCE",
    value: "",
    completed: true,
    updatedAt: "",
    updatedBy: "System",
    commentRefs: [],
  };

  const timelineEntry = {
    createdAt: "",
    eventType: "TASK_COMPLETED",
    createdBy: "System",
    commentRef: null,
    description: "SitiAgri FC Reference",
    data: {
      caseRef: "",
    },
  };

  const collection = "cases";

  withTransaction(async (session) => {
    Object.keys(refs).forEach(async (key) => {
      const kase = await db
        .collection(collection)
        .findOne({ "payload.identifiers.sbi": key });

      if (kase) {
        const stage = kase.phases
          .find((phase) => phase.code === "PHASE_PRE_AWARD")
          ?.stages.find((stage) => stage.code === "STAGE_AGREEMENT_ACCEPTED");

        if (stage) {
          const taskGroup = stage.taskGroups && stage.taskGroups[0];
          const date = new Date().toISOString();
          if (taskGroup) {
            taskGroup?.tasks?.unshift({
              ...task,
              value: refs[key],
              updatedAt: date,
            });

            kase.timeline?.unshift({
              ...timelineEntry,
              createdAt: date,
              data: {
                caseRef: kase.caseRef,
              },
            });
            await db
              .collection(collection)
              .updateOne(
                { "payload.identifiers.sbi": key },
                { $set: { phases: kase.phases, timeline: kase.timeline } },
                { session },
              );
          }
        } else {
          console.warn(
            `Stage STAGE_AGREEMENT_UPDATED not found on Case with sbi ${key}.`,
          );
        }
      } else {
        console.warn(`Case with sbi ${key} was not found.`);
      }
    });
  });
};
