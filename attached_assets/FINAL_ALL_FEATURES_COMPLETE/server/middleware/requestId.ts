import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";

declare module "http" {
  interface IncomingMessage {
    requestId?: string;
  }
}

export function requestId(req: Request, res: Response, next: NextFunction) {
  const incoming = req.header("x-request-id");
  const id = incoming && incoming.trim() !== "" ? incoming : randomUUID();
  req.requestId = id;
  res.locals.requestId = id;
  res.setHeader("x-request-id", id);
  next();
}
