/**
 * Pick only the requested keys from an object.
 * Returns the full object when `fields` is undefined or empty.
 */
export function pickFields<T extends Record<string, unknown>>(
  data: T,
  fields?: string[],
): Partial<T> {
  if (!fields || fields.length === 0) return data;

  const result: Record<string, unknown> = {};
  for (const key of fields) {
    if (key in data) {
      result[key] = data[key];
    }
  }
  return result as Partial<T>;
}
