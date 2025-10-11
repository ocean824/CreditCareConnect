import type { Request, Response, NextFunction } from "express";

export function adminOnly(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const user = req.user as any;
  if (user.role !== 'admin') {
    return res.status(403).json({ message: "Forbidden - Admin access required" });
  }

  next();
}
