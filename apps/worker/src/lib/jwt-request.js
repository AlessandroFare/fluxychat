import { verifyJwtAndGetContext as verifyJwtCore } from "./jwt-auth.js";
import { logInfo } from "./worker-log.js";

export async function verifyJwtAndGetContext(request, env) {
  return verifyJwtCore(request, env, { logInfo });
}
