import type { Request, Response, NextFunction } from "express";
import { RateLimitError } from "../errors";

// Simple in-memory sliding window per key
type Bucket = { resetAt: number; count: number };
const buckets = new Map<string, Bucket>();

export function rateLimit({ windowMs, max, key = (req: Request) => req.ip! }: {
  windowMs: number; max: number; key?: (req: Request) => string;
}) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const k = key(req);
    const now = Date.now();
    const b = buckets.get(k);
    if (!b || b.resetAt <= now) {
      buckets.set(k, { resetAt: now + windowMs, count: 1 });
      return next();
    }
    if (b.count >= max) {
      return next(new RateLimitError());
    }
    b.count++;
    return next();
  };
}
