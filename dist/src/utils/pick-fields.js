/**
 * Pick only the requested keys from an object.
 * Returns the full object when `fields` is undefined or empty.
 */
export function pickFields(data, fields) {
    if (!fields || fields.length === 0)
        return data;
    const result = {};
    for (const key of fields) {
        if (key in data) {
            result[key] = data[key];
        }
    }
    return result;
}
