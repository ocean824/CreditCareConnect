import { describe, it, expect } from "vitest";
import { ValidationError, AuthError, RateLimitError, NotFoundError } from "../../server/errors";

describe("Errors", () => {
  it("ValidationError carries code/status", () => {
    const e = new ValidationError("bad");
    expect(e.code).toBe("VALIDATION_ERROR");
    expect(e.status).toBe(422);
  });
  it("AuthError is 401", () => {
    const e = new AuthError();
    expect(e.status).toBe(401);
  });
  it("RateLimitError is 429", () => {
    const e = new RateLimitError();
    expect(e.status).toBe(429);
  });
  it("NotFoundError is 404", () => {
    const e = new NotFoundError();
    expect(e.status).toBe(404);
  });
});
