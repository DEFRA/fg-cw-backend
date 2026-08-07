import { withTransaction } from "../src/common/with-transaction.js";

export const up = async (db) => {
  const refs = {
    "wood-1001": 1010101,

    // develop
    "wmp-967-b2u": 2222222,

    // test
    "wmp-zum-ypr": 3333333,

    //
    "wmp-l8r-329": 2326337,
    "wmp-rku-ha4": 2348574,
    "wmp-ylw-4jl": 2305310,
    "wmp-vt8-j4a": 2342972,
    "wmp-x7m-l38": 2337697,
    "wmp-2ax-726": 2338801,
    "wmp-5f4-jza": 2338146,
    "wmp-ns8-j3x": 2298162,
    "wmp-js2-u7c": 2295123,
    "wmp-4u7-dm3": 2341558,
    "wmp-yjd-ww3": 2320439,
    "wmp-sh3-d4k": 2339149,
    "wmp-9kn-87r": 2314222,
    "wmp-lam-zvk": 2286716,
    "wmp-5kb-wav": 2315984,
    "wmp-fuh-rwr": 2338513,
    "wmp-sat-n6h": 2332924,
    "wmp-ve5-bxu": 2337012,
    "wmp-tc3-ac8": 2342146,
    "wmp-24b-wyn": 2323988,
    "wmp-mrl-b74": 2265948,
    "wmp-vwd-bhm": 2265872,
    "wmp-nvk-v6v": 2337691,
    "wmp-4tm-txn": 2337285,
    "wmp-ref-uk5": 2328369,
    "wmp-6zl-s7t": 2334316,
    "wmp-7nw-dl3": 2342831,
    "wmp-c2n-4z8": 2286938,
    "wmp-398-75z": 2244737,
    "wmp-s8l-2hr": 2338603,
    "wmp-u5x-mu9": 2263459,
    "wmp-ldb-szm": 2283622,
    "wmp-mxs-sw9": 2286784,
    "wmp-ch2-zcl": 2297777,
    "wmp-awp-bkp": 2291951,
    "wmp-3zp-hwl": 2318913,
    "wmp-8cv-768": 2341576,
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

  await withTransaction(async (session) => {
    for (const [caseRef, ref] of Object.entries(refs)) {
      const kase = await db
        .collection(collection)
        .findOne({ caseRef, workflowCode: "woodland" }, { session });

      if (!kase) {
        console.warn(`Case with caseRef ${caseRef} was not found.`);
        continue;
      }

      const stage = kase.phases
        .find((phase) => phase.code === "PHASE_PRE_AWARD")
        ?.stages.find((stage) => stage.code === "STAGE_AGREEMENT_ACCEPTED");

      if (!stage) {
        console.warn(
          `Stage STAGE_AGREEMENT_ACCEPTED not found on Case with caseRef ${caseRef}.`,
        );
        continue;
      }

      const taskGroup = stage.taskGroups?.[0];

      if (!taskGroup) {
        continue;
      }

      if (taskGroup.tasks?.some((t) => t.code === task.code)) {
        continue;
      }

      const date = new Date().toISOString();

      taskGroup.tasks?.unshift({
        ...task,
        value: String(ref),
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
          { caseRef, workflowCode: "woodland" },
          { $set: { phases: kase.phases, timeline: kase.timeline } },
          { session },
        );
    }
  });
};
