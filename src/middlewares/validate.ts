import type { NextFunction, Request, Response } from "express";
import { type ZodIssue, type ZodSchema } from "zod";

/**
 * Express middleware factory that validates `req.body` against a Zod schema.
 * On failure it returns a 400 JSON response with structured error details.
 */
export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const errors = result.error.issues.map((e: ZodIssue) => ({
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
