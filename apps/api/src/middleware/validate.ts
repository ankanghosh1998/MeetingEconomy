import type { AnyZodObject, ZodTypeAny } from "zod";
import type { NextFunction, Request, Response } from "express";

export function validate(schema: {
  body?: ZodTypeAny;
  query?: AnyZodObject;
  params?: AnyZodObject;
}) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (schema.body) req.body = schema.body.parse(req.body);
    if (schema.query) req.query = schema.query.parse(req.query);
    if (schema.params) req.params = schema.params.parse(req.params);
    next();
  };
}
