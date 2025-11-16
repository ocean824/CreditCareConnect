import crypto from "crypto";
import { db } from "./db";
import { actionTokens } from "@shared/schema";
import { eq } from "drizzle-orm";

export async function mintActionToken(clientId: string, caseId: string, purpose: string, ttlHours = 168) {
  const token = crypto.randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + ttlHours * 3600 * 1000);
  await db.insert(actionTokens).values({ token, clientId, caseId, purpose, expiresAt, used: false });
  return token;
}

export async function verifyAndConsumeToken(token: string) {
  const row = (await db.select().from(actionTokens).where(eq(actionTokens.token, token))).at(0);
  if (!row) throw new Error("bad_token");
  if (row.used) throw new Error("used_token");
  if (new Date(row.expiresAt) < new Date()) throw new Error("expired_token");
  await db.update(actionTokens).set({ used: true }).where(eq(actionTokens.token, token));
  return row;
}
