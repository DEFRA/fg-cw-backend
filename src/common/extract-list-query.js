import { config } from "./config.js";

const getPage = (page) => (page ? parseInt(page) || 1 : 1);

const getPageSize = (pageSize) =>
  pageSize ? parseInt(pageSize) || config.get("api").pageSize : 100;

export const extractListQuery = (request) => ({
  page: getPage(request.query?.page),
  pageSize: getPageSize(request.query?.pageSize),
});
