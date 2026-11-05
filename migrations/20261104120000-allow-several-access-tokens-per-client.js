// FGP-1572: a client may now hold several tokens, so its name is no longer
// unique. The hash stays unique.
const isUniqueClientIndex = (index) =>
  index.name === "client_1" && index.unique === true;

export const up = async (db) => {
  const accessTokens = db.collection("access_tokens");

  if ((await accessTokens.indexes()).some(isUniqueClientIndex)) {
    await accessTokens.dropIndex("client_1");
  }

  await accessTokens.createIndex({ client: 1 });
  await accessTokens.createIndex({ expiresAt: 1 });
};
