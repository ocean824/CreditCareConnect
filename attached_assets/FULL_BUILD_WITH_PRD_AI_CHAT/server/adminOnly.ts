import type { Request, Response, NextFunction } from "express";
import { UnauthorizedError, ForbiddenError } from "./errors";

export function adminOnly(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return next(new UnauthorizedError("Not authenticated"));
  }

  const user = req.user as any;
  if (user.role !== 'admin') {
    return next(new ForbiddenError("Admin access required"));
  }

  next();
}
