import { Case } from "../models/case.js";

export const toCase = (doc) => new Case(doc);
