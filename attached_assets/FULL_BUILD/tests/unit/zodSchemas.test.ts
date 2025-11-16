import { describe, it, expect } from "vitest";
import { createInsertSchema } from "drizzle-zod";
import { creditReports } from "@shared/schema";

describe("Zod / Drizzle", () => {
  it("builds an insert schema for creditReports", () => {
    const Insert = createInsertSchema(creditReports);
    const parsed = Insert.safeParse({ userId: "u1", fileName: "a.pdf", fileUrl: "/files/a.pdf" });
    expect(parsed.success).toBe(true);
  });
});
