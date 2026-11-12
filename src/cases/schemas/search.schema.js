import { searchDeclaration } from "../../common/search/declaration.js";

// The fields an admin searches a workflow's cases by, read from the case's
// payload and supplementary data, as its pages address them.
export const search = searchDeclaration(["$.payload.", "$.supplementaryData."]);
