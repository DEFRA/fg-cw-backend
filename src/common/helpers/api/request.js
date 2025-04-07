import { config } from "../../../config.js";

export const extractListQuery = (request) => ({
  page: request.query?.page ? parseInt(request.query.page) || 1 : 1,
  pageSize: request.query?.pageSize
    ? parseInt(request.query?.pageSize) || config.get("api").pageSize || 10
    : 100
});
