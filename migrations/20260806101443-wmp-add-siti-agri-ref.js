import { withTransaction } from "../src/common/with-transaction.js";

export const up = async (db) => {
  const refs = {
    // develop
    "wmp-000-183": 2222222, // is accepted
    "wmp-000-226": 2222222, // not at accepted stage
    // test
    "wmp-000-230": 3333333, // is accepted
    "wmp-000-172": 3333333, // not at accepted stage

    // prod
    "wmp-000-196": 7900023,
    "wmp-000-211": 7900055,
    "wmp-000-228": 7900017,
    "wmp-000-223": 7900045,
    "wmp-000-225": 7900033,
    "wmp-000-168": 7900037,
    "wmp-000-176": 7900034,
    "wmp-000-205": 7900016,
    "wmp-000-195": 7900013,
    "wmp-000-174": 7900041,
    "wmp-000-227": 7900021,
    "wmp-000-215": 7900038,
    "wmp-000-184": 7900018,
    "wmp-000-197": 7900009,
    "wmp-000-177": 7900019,
    "wmp-000-192": 7900035,
    "wmp-000-214": 7900026,
    "wmp-000-221": 7900030,
    "wmp-000-216": 7900043,
    "wmp-000-167": 7900022,
    "wmp-000-202": 7900007,
    "wmp-000-224": 7900006,
    "wmp-000-206": 7900032,
    "wmp-000-173": 7900031,
    "wmp-000-210": 7900024,
    "wmp-000-178": 7900027,
    "wmp-000-180": 7900044,
    "wmp-000-187": 7900011,
    "wmp-000-170": 7900003,
    "wmp-000-213": 7900036,
    "wmp-000-218": 7900004,
    "wmp-000-198": 7900008,
    "wmp-000-203": 7900010,
    "wmp-000-189": 7900015,
    "wmp-000-185": 7900012,
    "wmp-000-171": 7900020,
    "wmp-000-182": 7900042,
    "wmp-000-194": 7900014,
    "wmp-000-229": 7900039,
    "wmp-000-204": 7900005,
    "wmp-000-166": 7900029,
    "wmp-000-186": 7900062,
    "wmp-000-199": 7900057,
    "wmp-000-175": 7900050,
    "wmp-000-212": 7900052,
    "wmp-000-207": 7900028,
    "wmp-000-222": 7900049,
    "wmp-000-208": 7900047,
    "wmp-000-219": 7900046,
    "wmp-000-190": 7900058,
    "wmp-000-181": 7900025,
    "wmp-000-209": 7900048,
    "wmp-000-217": 7900061,
    "wmp-000-179": 7900053,
    "wmp-000-188": 7900059,
    "wmp-000-193": 7900056,
    "wmp-000-200": 7900060,
    "wmp-000-201": 7900040,
    "wmp-000-191": 7900054,
    "wmp-000-169": 7900051,
    "wmp-000-220": 7900063,
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
