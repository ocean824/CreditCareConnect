import { describe, it, expect } from "vitest";
import { rateLimit } from "../../server/middleware/rateLimit";

describe("rateLimit", () => {
  it("allows under limit", () => {
    const mw = rateLimit({ windowMs: 1000, max: 2, key: () => "k" });
    let calls = 0;
    const next = () => { calls++; };
    mw({} as any, {} as any, next);
    mw({} as any, {} as any, next);
    expect(calls).toBe(2);
  });
});
