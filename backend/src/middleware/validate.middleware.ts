import { Request, Response, NextFunction } from 'express';
import { ZodTypeAny } from 'zod';

export const validateRequest = (schema: ZodTypeAny) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync(req.body);
      next();
    } catch (error: any) {
      res.status(400).json({ error: error.errors });
    }
  };
};
