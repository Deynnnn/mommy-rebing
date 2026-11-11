const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Returns the list if it is an array of UUIDs (max 5000), else null. */
export function parseIds(v: unknown): string[] | null {
  if (!Array.isArray(v) || v.length > 5000) return null;
  return v.every((id) => typeof id === "string" && UUID.test(id)) ? (v as string[]) : null;
}
