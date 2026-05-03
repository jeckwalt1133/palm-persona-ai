import { z } from 'zod';

export function bodySchema<T extends z.ZodTypeAny>(schema: T) {
  return { body: schema };
}

export function querySchema<T extends z.ZodTypeAny>(schema: T) {
  return { querystring: schema };
}

export function paramsSchema<T extends z.ZodTypeAny>(schema: T) {
  return { params: schema };
}
