import { MongoClient } from "mongodb";
import tls from "node:tls";
import { config } from "./config.js";

export const getReadPreference = () => {
  return process.env.NODE_ENV === "production" ? "secondary" : "primary";
};

export const mongoClient = new MongoClient(config.get("mongo.uri"), {
  retryWrites: false,
  readPreference: getReadPreference(),
  secureContext: tls.createSecureContext(),
});

export const db = mongoClient.db(config.get("mongo.databaseName"));
