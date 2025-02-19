export const throwErrorIfForceErrorEnabled = (): void => {
  if (process.env.IS_FORCE_ERROR_ENABLED === "true") {
    throw new Error("デバッグ用の意図的なエラーです");
  }
};
