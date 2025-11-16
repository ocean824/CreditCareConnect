import type { RequestHandler } from "express";

/**
 * Test-only auth shim. Enabled iff TEST_AUTH=1.
 * Use headers:
 *  - X-Test-User: email
 *  - X-Test-Role: user|admin
 */
export const testAuth: RequestHandler = (req, _res, next) => {
  if (process.env.TEST_AUTH !== "1") return next();
  const email = req.header("X-Test-User");
  const role = (req.header("X-Test-Role") || "user") as "user"|"admin";
  if (email) {
    (req as any).isAuthenticated = () => true;
    (req as any).user = { claims: { sub: `test_${email}`, email }, role };
  }
  next();
};
