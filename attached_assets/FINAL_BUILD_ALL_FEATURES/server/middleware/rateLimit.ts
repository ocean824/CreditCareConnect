import type { Request, Response, NextFunction } from "express";
import { RateLimitError } from "../errors";

// Simple in-memory sliding window per key
type Bucket = { resetAt: number; count: number };

export function rateLimit({ windowMs, max, key = (req: Request) => req.ip!, namespace = 'default' }: {
  windowMs: number; max: number; key?: (req: Request) => string; namespace?: string;
}) {
  // Each rate limiter instance gets its own bucket map
  const buckets = new Map<string, Bucket>();
  
  return (req: Request, _res: Response, next: NextFunction) => {
    const k = `${namespace}:${key(req)}`;
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
