export function logInfo(event, context = {}) {
  console.log(
    JSON.stringify({
      level: "info",
      event,
      ts: new Date().toISOString(),
      ...context,
    })
  );
}

export function logError(event, error, context = {}) {
  const details =
    error instanceof Error
      ? { message: error.message, stack: error.stack }
      : { message: String(error) };
  console.error(
    JSON.stringify({
      level: "error",
      event,
      ts: new Date().toISOString(),
      ...context,
      error: details,
    })
  );
}
