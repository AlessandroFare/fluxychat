const VALID_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;

export function isValidId(id) {
  return typeof id === "string" && VALID_ID_REGEX.test(id);
}
