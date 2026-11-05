// GAS and GPA tell one refusal from another by `errorCode`, never by message.
export const withErrorCode = (error, errorCode) => {
  error.output.payload.errorCode = errorCode;

  return error;
};
