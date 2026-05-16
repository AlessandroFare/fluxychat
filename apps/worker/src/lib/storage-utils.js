export function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function truncateForStorage(text, max = 500) {
  if (!text) return null;
  const value = String(text);
  return value.length > max ? `${value.slice(0, max)}...` : value;
}
