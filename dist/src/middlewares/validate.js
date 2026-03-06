/**
 * Express middleware factory that validates `req.body` against a Zod schema.
 * On failure it returns a 400 JSON response with structured error details.
 */
export function validateBody(schema) {
    return (req, res, next) => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            const errors = result.error.issues.map((e) => ({
                field: e.path.join("."),
                message: e.message,
            }));
            res.status(400).json({ success: false, errors });
            return;
        }
        // Replace body with parsed (coerced / transformed) data
        req.body = result.data;
        next();
    };
}
