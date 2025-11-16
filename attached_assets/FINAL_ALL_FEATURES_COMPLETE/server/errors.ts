export type ErrorCode =
  | "VALIDATION_ERROR"
  | "AUTH_ERROR"
  | "FORBIDDEN"
  | "RATE_LIMITED"
  | "EXTERNAL_SERVICE"
  | "CONFLICT"
  | "NOT_FOUND"
  | "INTERNAL_ERROR";

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly status: number;
  public readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, status = 400, details?: Record<string, unknown>) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("VALIDATION_ERROR", message, 422, details);
  }
}
export class AuthError extends AppError {
  constructor(message = "Unauthorized") { super("AUTH_ERROR", message, 401); }
}
export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") { super("AUTH_ERROR", message, 401); }
}
export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") { super("FORBIDDEN", message, 403); }
}
export class RateLimitError extends AppError {
  constructor(message = "Too Many Requests") { super("RATE_LIMITED", message, 429); }
}
export class ExternalServiceError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("EXTERNAL_SERVICE", message, 502, details);
  }
}
export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("CONFLICT", message, 409, details);
  }
}
export class NotFoundError extends AppError {
  constructor(message = "Not Found") { super("NOT_FOUND", message, 404); }
}
