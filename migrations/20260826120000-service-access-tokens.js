export const up = async (db) => {
  const accessTokens = db.collection("access_tokens");

  await accessTokens.createIndex({ id: 1 }, { unique: true });
  await accessTokens.createIndex({ client: 1 }, { unique: true });
};
