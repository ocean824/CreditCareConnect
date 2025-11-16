import { db } from "./db";
import { mailBatches, users } from "@shared/schema";
import { and, lte, inArray, eq } from "drizzle-orm";
import { notificationService } from "./services/notificationService";
import { mintActionToken } from "./oneTimeToken";

const PUBLIC_URL = process.env.PUBLIC_URL || "http://localhost:3000";

export async function runDay34Sweep() {
  const cutoff = new Date(Date.now() - 34 * 24 * 3600 * 1000);
  const rows = await db
    .select({
      clientId: mailBatches.clientId,
      caseId: mailBatches.caseId
    })
    .from(mailBatches)
    .where(and(lte(mailBatches.createdAt, cutoff), inArray(mailBatches.status, ["mailed", "in_transit", "delivered"])))
    .groupBy(mailBatches.caseId, mailBatches.clientId);

  for (const r of rows) {
    const client = (await db.select().from(users).where(eq(users.id, r.clientId))).at(0);
    if (!client) continue;
    const yesTok = await mintActionToken(r.clientId, r.caseId, "day34_yes");
    const noTok  = await mintActionToken(r.clientId, r.caseId, "day34_no");
    const upTok  = await mintActionToken(r.clientId, r.caseId, "upload_response");
    const yesUrl = `${PUBLIC_URL}/notify/answer?token=${yesTok}`;
    const noUrl  = `${PUBLIC_URL}/notify/answer?token=${noTok}`;
    const uploadUrl = `${PUBLIC_URL}/notify/upload?token=${upTok}`;

    const html = `
      <p>Quick check-in: did you receive any letters from the credit bureaus?</p>
      <p>
        <a href="${yesUrl}" style="padding:10px 16px;background:#0a7;border-radius:8px;color:#fff;text-decoration:none;">Yes</a>
        &nbsp;&nbsp;
        <a href="${noUrl}" style="padding:10px 16px;background:#777;border-radius:8px;color:#fff;text-decoration:none;">No</a>
      </p>
      <p>If yes, upload a photo/PDF here: <a href="${uploadUrl}">Upload your bureau letter</a></p>
    `;

    await notificationService.sendEmail(client.email, "Day 34 check-in", html);
    if ((notificationService as any).sendSms && client.phone) {
      await (notificationService as any).sendSms(client.phone, `Day 34 check-in: Yes: ${yesUrl}  No: ${noUrl}  Upload: ${uploadUrl}`);
    }
  }
}

// hourly
setInterval(() => runDay34Sweep().catch(console.error), 60 * 60 * 1000);
