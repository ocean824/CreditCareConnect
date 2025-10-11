import { db } from "@db";
import { adminAuditLogs } from "@shared/schema";

export async function logAudit(
  actorId: string,
  action: string,
  targetType: string,
  targetId: string,
  meta?: any
) {
  await db.insert(adminAuditLogs).values({
    actorId,
    action,
    targetType,
    targetId,
    meta: meta || null,
  });
}
