import { db } from "../../common/mongo-client.js";
import { config } from "../../common/config.js";
import { toCase } from "./to-case.js";
import { collection } from "./constants.js";

export const findAll = async (listQuery) => {
  const { page = 1, pageSize = config.get("api.pageSize") ?? 1000 } = listQuery;
  const skip = (page - 1) * pageSize;
  const count = await db.collection(collection).estimatedDocumentCount();
  const pageCount = Math.ceil(count / pageSize);
  const data = await db
    .collection(collection)
    .find()
    .skip(skip)
    .limit(pageSize)
    .map(toCase)
    .toArray();

  return {
    status: "success",
    metadata: {
      ...listQuery,
      count,
      pageCount
    },
    data
  };
};
