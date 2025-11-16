import type { ErrorRequestHandler } from "express";
import { AppError } from "../errors";

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const requestId = (req as any).requestId || res.locals.requestId;
  if (err instanceof AppError) {
    res.status(err.status).json({
      code: err.code,
      message: err.message,
      details: err.details,
      requestId
    });
    return;
  }

  // Unknown/unexpected
  const status = typeof err?.status === "number" ? err.status : 500;
  const code = status === 404 ? "NOT_FOUND" : "INTERNAL_ERROR";
  const message = status === 404 ? "Not Found" : "Internal Server Error";
  res.status(status).json({ code, message, requestId });
};
