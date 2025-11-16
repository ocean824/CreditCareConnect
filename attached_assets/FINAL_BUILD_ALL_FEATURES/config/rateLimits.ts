export const rateLimits = {
  chat: { windowMs: 60_000, max: 30 }, // 30 requests per minute
  upload: { windowMs: 60_000, max: 10 }, // 10 uploads per minute
  apiDefault: { windowMs: 60_000, max: 100 } // 100 requests per minute
};
