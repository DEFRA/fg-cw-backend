// What a workflow's declared search paths are read against.
export const caseViewOf = ({ payload, supplementaryData }) => ({
  payload: payload ?? {},
  supplementaryData: supplementaryData ?? {},
});
