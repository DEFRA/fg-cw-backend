import { MongoClient, ObjectId } from "mongodb";
import { env } from "node:process";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { up as roundTotalHectares } from "../../migrations/20261109120000-round-wmp-total-hectares.js";
import { logger } from "../../src/common/logger.js";

vi.mock("../../src/common/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const aCase = (caseRef, answers, workflowCode = "woodland") => ({
  _id: new ObjectId(),
  caseRef,
  workflowCode,
  createdAt: new Date("2026-11-05T09:38:08.035Z"),
  currentPhase: "PHASE_PRE_AWARD",
  currentStage: "STAGE_REVIEW_APPLICATION",
  currentStatus: "STATUS_RECEIVED",
  payload: {
    createdAt: "2026-11-05T09:38:07.443Z",
    submittedAt: "2026-11-05T09:38:07.385Z",
    ...(answers && { answers }),
  },
  timeline: [{ eventType: "CASE_CREATED", data: { caseRef } }],
});

let client;
let db;

const cases = () => db.collection("cases");

const findByRef = (caseRef) => cases().findOne({ caseRef });

const migrate = () => roundTotalHectares(db);

beforeAll(async () => {
  client = await MongoClient.connect(env.MONGO_URI);
  db = client.db("round-wmp-total-hectares-migration");
});

afterAll(async () => {
  await db?.dropDatabase();
  await client?.close(true);
});

beforeEach(async () => {
  vi.clearAllMocks();
  await db.dropDatabase();
});

describe("20261109120000-round-wmp-total-hectares", () => {
  it("rounds an unrounded total and leaves the rest of the case as stored", async () => {
    const stored = aCase("wmp-unrounded", {
      woodlandName: "Test wood",
      totalHectaresForSelectedParcels: 270.54729999999995,
      landParcels: [{ parcelId: "SD0000-0001", areaHa: 129.2422 }],
    });
    await cases().insertOne(stored);

    await migrate();

    expect(await findByRef("wmp-unrounded")).toStrictEqual({
      ...stored,
      payload: {
        ...stored.payload,
        answers: {
          woodlandName: "Test wood",
          totalHectaresForSelectedParcels: 270.5473,
          landParcels: [{ parcelId: "SD0000-0001", areaHa: 129.2422 }],
        },
      },
    });
  });

  it.each([
    [4.3024000000000004, 4.3024],
    [12.605900000000002, 12.6059],
    [13.778399999999998, 13.7784],
  ])("rounds %d to %d", async (from, to) => {
    await cases().insertOne(
      aCase("wmp-noise", { totalHectaresForSelectedParcels: from }),
    );

    await migrate();

    const { payload } = await findByRef("wmp-noise");
    expect(payload.answers.totalHectaresForSelectedParcels).toBe(to);
  });

  it("leaves clean, missing and non-numeric totals and other workflows as stored", async () => {
    const stored = [
      aCase("wmp-clean", { totalHectaresForSelectedParcels: 270.5473 }),
      aCase("wmp-whole", { totalHectaresForSelectedParcels: 20 }),
      aCase("wmp-missing", { woodlandName: "Test wood" }),
      aCase("wmp-text", { totalHectaresForSelectedParcels: "4.30240000001" }),
      aCase("wmp-no-answers", null),
      aCase(
        "frps-unrounded",
        { totalHectaresForSelectedParcels: 4.3024000000000004 },
        "frps-private-beta",
      ),
    ];
    await cases().insertMany(stored);

    await migrate();

    expect(await cases().find({}).sort({ caseRef: 1 }).toArray()).toStrictEqual(
      [...stored].sort((a, b) => a.caseRef.localeCompare(b.caseRef)),
    );
  });

  it("logs each value it rounded and changes nothing when run again", async () => {
    await cases().insertMany([
      aCase("wmp-c", { totalHectaresForSelectedParcels: 13.778399999999998 }),
      aCase("wmp-a", { totalHectaresForSelectedParcels: 4.3024000000000004 }),
      aCase("wmp-b", { totalHectaresForSelectedParcels: 270.5473 }),
    ]);

    await migrate();
    const once = await cases().find({}).toArray();
    await migrate();

    expect(await cases().find({}).toArray()).toStrictEqual(once);
    expect(logger.info.mock.calls).toEqual([
      [
        "Rounding totalHectaresForSelectedParcels on case wmp-a: 4.3024000000000004 -> 4.3024",
      ],
      [
        "Rounding totalHectaresForSelectedParcels on case wmp-c: 13.778399999999998 -> 13.7784",
      ],
      [
        "Rounded totalHectaresForSelectedParcels to 4 decimal places on 2 woodland cases",
      ],
      [
        "Rounded totalHectaresForSelectedParcels to 4 decimal places on 0 woodland cases",
      ],
    ]);
  });
});
