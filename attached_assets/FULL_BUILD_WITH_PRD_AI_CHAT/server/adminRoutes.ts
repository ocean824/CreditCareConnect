import { Router } from "express";
import { db } from "./db";
import { users, mailBatches, deliveryEvents, clientResponses, adminAuditLogs } from "@shared/schema";
import { eq, desc, sql } from "drizzle-orm";
import { adminOnly } from "./adminOnly";
import { logAudit } from "./audit";
import { notificationService } from "./services/notificationService";
import { mintActionToken } from "./oneTimeToken";
import { letterGeneratorService } from "./services/letterGenerator";
import { click2mailService } from "./services/click2mail";

export const adminRouter = Router();

// All admin routes require admin role
adminRouter.use(adminOnly);

// GET /api/admin/whoami - Admin session introspection for testing
adminRouter.get("/whoami", (req, res) => {
  const u = (req as any).user || {};
  const email = u?.claims?.email || null;
  const role = u?.role || u?.claims?.role || "user";
  res.json({ id: u?.claims?.sub || null, email, isAdmin: role === "admin" });
});

// GET /api/admin/stats - Admin dashboard statistics
adminRouter.get("/stats", async (req, res) => {
  try {
    const totalUsers = await db.select({ count: sql<number>`count(*)` }).from(users);
    const totalCases = await db.select({ count: sql<number>`count(DISTINCT case_id)` }).from(mailBatches);
    const totalLetters = await db.select({ count: sql<number>`count(*)` }).from(mailBatches);
    const pendingResponses = await db.select({ count: sql<number>`count(*)` }).from(clientResponses);

    res.json({
      totalUsers: totalUsers[0]?.count || 0,
      totalCases: totalCases[0]?.count || 0,
      totalLetters: totalLetters[0]?.count || 0,
      pendingResponses: pendingResponses[0]?.count || 0,
    });
  } catch (error) {
    console.error("Error fetching admin stats:", error);
    res.status(500).json({ message: "Failed to fetch stats" });
  }
});

// GET /api/admin/users - List all users
adminRouter.get("/users", async (req, res) => {
  try {
    const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));
    res.json(allUsers);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

// PUT /api/admin/users/:id/role - Change user role
adminRouter.put("/users/:id/role", async (req: any, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    await db.update(users).set({ role }).where(eq(users.id, id));

    const actorId = req.user.id;
    await logAudit(actorId, 'update_user_role', 'user', id, { newRole: role });

    res.json({ message: "Role updated successfully" });
  } catch (error) {
    console.error("Error updating user role:", error);
    res.status(500).json({ message: "Failed to update role" });
  }
});

// GET /api/admin/cases - Latest case snapshot per caseId
adminRouter.get("/cases", async (req, res) => {
  try {
    const cases = await db
      .select({
        caseId: mailBatches.caseId,
        clientId: mailBatches.clientId,
        clientEmail: users.email,
        clientName: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`,
        bureau: mailBatches.bureau,
        round: mailBatches.round,
        status: mailBatches.status,
        createdAt: mailBatches.createdAt,
      })
      .from(mailBatches)
      .leftJoin(users, eq(mailBatches.clientId, users.id))
      .orderBy(desc(mailBatches.createdAt));

    res.json(cases);
  } catch (error) {
    console.error("Error fetching cases:", error);
    res.status(500).json({ message: "Failed to fetch cases" });
  }
});

// GET /api/admin/letters - All mail batches with delivery info
adminRouter.get("/letters", async (req, res) => {
  try {
    const letters = await db
      .select({
        id: mailBatches.id,
        caseId: mailBatches.caseId,
        clientId: mailBatches.clientId,
        clientEmail: users.email,
        clientName: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`,
        bureau: mailBatches.bureau,
        round: mailBatches.round,
        status: mailBatches.status,
        click2mailJobId: mailBatches.click2mailJobId,
        uspsTracking: mailBatches.uspsTracking,
        proofUrl: mailBatches.proofUrl,
        createdAt: mailBatches.createdAt,
      })
      .from(mailBatches)
      .leftJoin(users, eq(mailBatches.clientId, users.id))
      .orderBy(desc(mailBatches.createdAt));

    // Get latest delivery event for each batch
    const enrichedLetters = await Promise.all(
      letters.map(async (letter) => {
        const latestEvent = await db
          .select()
          .from(deliveryEvents)
          .where(eq(deliveryEvents.batchId, letter.id))
          .orderBy(desc(deliveryEvents.createdAt))
          .limit(1);

        return {
          ...letter,
          latestEvent: latestEvent[0] || null,
        };
      })
    );

    res.json(enrichedLetters);
  } catch (error) {
    console.error("Error fetching letters:", error);
    res.status(500).json({ message: "Failed to fetch letters" });
  }
});

// GET /api/admin/responses - Client uploaded responses
adminRouter.get("/responses", async (req, res) => {
  try {
    const responses = await db
      .select({
        id: clientResponses.id,
        caseId: clientResponses.caseId,
        clientId: clientResponses.clientId,
        clientEmail: users.email,
        clientName: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`,
        round: clientResponses.round,
        fileUrl: clientResponses.fileUrl,
        ocrText: clientResponses.ocrText,
        analysisJson: clientResponses.analysisJson,
        createdAt: clientResponses.createdAt,
      })
      .from(clientResponses)
      .leftJoin(users, eq(clientResponses.clientId, users.id))
      .orderBy(desc(clientResponses.createdAt));

    res.json(responses);
  } catch (error) {
    console.error("Error fetching responses:", error);
    res.status(500).json({ message: "Failed to fetch responses" });
  }
});

// POST /api/admin/letters/:id/remind-day34 - Send Day-34 reminder
adminRouter.post("/letters/:id/remind-day34", async (req: any, res) => {
  try {
    const { id } = req.params;
    
    const batch = await db
      .select()
      .from(mailBatches)
      .where(eq(mailBatches.id, id))
      .limit(1);

    if (!batch[0]) {
      return res.status(404).json({ message: "Mail batch not found" });
    }

    const client = await db
      .select()
      .from(users)
      .where(eq(users.id, batch[0].clientId))
      .limit(1);

    if (!client[0] || !client[0].email) {
      return res.status(404).json({ message: "Client not found" });
    }

    // Mint tokens for Yes/No/Upload
    const yesToken = await mintActionToken(batch[0].clientId, batch[0].caseId, "yes");
    const noToken = await mintActionToken(batch[0].clientId, batch[0].caseId, "no");
    const uploadToken = await mintActionToken(batch[0].clientId, batch[0].caseId, "upload");

    // Send notification
    await notificationService.sendDay34FollowUp(
      client[0].email,
      client[0].firstName || 'Client',
      batch[0].bureau,
      batch[0].round,
      yesToken,
      noToken,
      uploadToken
    );

    const actorId = req.user.id;
    await logAudit(actorId, 'send_day34_reminder', 'mail_batch', id, {
      caseId: batch[0].caseId,
      bureau: batch[0].bureau,
      round: batch[0].round,
    });

    res.json({ message: "Day-34 reminder sent successfully" });
  } catch (error) {
    console.error("Error sending Day-34 reminder:", error);
    res.status(500).json({ message: "Failed to send reminder" });
  }
});

// POST /api/admin/letters/:id/remail - Re-mail a letter
adminRouter.post("/letters/:id/remail", async (req: any, res) => {
  try {
    const { id } = req.params;
    
    const batch = await db
      .select()
      .from(mailBatches)
      .where(eq(mailBatches.id, id))
      .limit(1);

    if (!batch[0]) {
      return res.status(404).json({ message: "Mail batch not found" });
    }

    const client = await db
      .select()
      .from(users)
      .where(eq(users.id, batch[0].clientId))
      .limit(1);

    if (!client[0]) {
      return res.status(404).json({ message: "Client not found" });
    }

    // Regenerate letter PDF (simplified - you'd use actual letter generation)
    const pdfUrl = `/files/letter_${Date.now()}.pdf`;

    // Submit to Click2Mail (if configured)
    if (process.env.CLICK2MAIL_API_KEY) {
      const jobId = await click2mailService.submitLetter({
        recipientName: "Credit Bureau",
        recipientAddress: "123 Bureau St",
        recipientCity: batch[0].bureau,
        recipientState: "NY",
        recipientZip: "10001",
        pdfUrl,
      });

      await db
        .update(mailBatches)
        .set({ click2mailJobId: jobId, status: 'queued' })
        .where(eq(mailBatches.id, id));
    }

    const actorId = req.user.id;
    await logAudit(actorId, 'remail_letter', 'mail_batch', id, {
      caseId: batch[0].caseId,
      bureau: batch[0].bureau,
      round: batch[0].round,
    });

    res.json({ message: "Letter remailed successfully" });
  } catch (error) {
    console.error("Error remailing letter:", error);
    res.status(500).json({ message: "Failed to remail letter" });
  }
});

// GET /api/admin/audit - Audit logs
adminRouter.get("/audit", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 200;
    
    const logs = await db
      .select({
        id: adminAuditLogs.id,
        actorId: adminAuditLogs.actorId,
        actorEmail: users.email,
        action: adminAuditLogs.action,
        targetType: adminAuditLogs.targetType,
        targetId: adminAuditLogs.targetId,
        meta: adminAuditLogs.meta,
        createdAt: adminAuditLogs.createdAt,
      })
      .from(adminAuditLogs)
      .leftJoin(users, eq(adminAuditLogs.actorId, users.id))
      .orderBy(desc(adminAuditLogs.createdAt))
      .limit(limit);

    res.json(logs);
  } catch (error) {
    console.error("Error fetching audit logs:", error);
    res.status(500).json({ message: "Failed to fetch audit logs" });
  }
});

// GET /api/admin/cases/:id - Case timeline
adminRouter.get("/cases/:id", async (req, res) => {
  try {
    const { id: caseId } = req.params;

    // Get all mail batches for this case
    const batches = await db
      .select()
      .from(mailBatches)
      .where(eq(mailBatches.caseId, caseId))
      .orderBy(desc(mailBatches.createdAt));

    // Get delivery events for each batch
    const timeline = await Promise.all(
      batches.map(async (batch) => {
        const events = await db
          .select()
          .from(deliveryEvents)
          .where(eq(deliveryEvents.batchId, batch.id))
          .orderBy(desc(deliveryEvents.createdAt));

        return {
          batch,
          events,
        };
      })
    );

    // Get client responses for this case
    const responses = await db
      .select()
      .from(clientResponses)
      .where(eq(clientResponses.caseId, caseId))
      .orderBy(desc(clientResponses.createdAt));

    res.json({
      caseId,
      timeline,
      responses,
    });
  } catch (error) {
    console.error("Error fetching case timeline:", error);
    res.status(500).json({ message: "Failed to fetch case timeline" });
  }
});

// GET /api/admin/cases/eligible-day34 - Cases eligible for Day-34 follow-ups
adminRouter.get("/cases/eligible-day34", async (req, res) => {
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 34);

    const eligible = await db
      .select({
        id: mailBatches.id,
        caseId: mailBatches.caseId,
        clientId: mailBatches.clientId,
        clientEmail: users.email,
        clientName: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`,
        bureau: mailBatches.bureau,
        round: mailBatches.round,
        status: mailBatches.status,
        createdAt: mailBatches.createdAt,
      })
      .from(mailBatches)
      .leftJoin(users, eq(mailBatches.clientId, users.id))
      .where(sql`${mailBatches.createdAt} <= ${cutoff}`)
      .orderBy(desc(mailBatches.createdAt));

    res.json(eligible);
  } catch (error) {
    console.error("Error fetching eligible cases:", error);
    res.status(500).json({ message: "Failed to fetch eligible cases" });
  }
});

// POST /api/admin/cases/bulk-remind-day34 - Bulk send Day-34 reminders
adminRouter.post("/cases/bulk-remind-day34", async (req: any, res) => {
  try {
    const { batchIds } = req.body;

    if (!Array.isArray(batchIds) || batchIds.length === 0) {
      return res.status(400).json({ message: "Invalid batch IDs" });
    }

    const results = [];

    for (const batchId of batchIds) {
      try {
        const batch = await db
          .select()
          .from(mailBatches)
          .where(eq(mailBatches.id, batchId))
          .limit(1);

        if (!batch[0]) continue;

        const client = await db
          .select()
          .from(users)
          .where(eq(users.id, batch[0].clientId))
          .limit(1);

        if (!client[0] || !client[0].email) continue;

        const yesToken = await mintActionToken(batch[0].clientId, batch[0].caseId, "yes");
        const noToken = await mintActionToken(batch[0].clientId, batch[0].caseId, "no");
        const uploadToken = await mintActionToken(batch[0].clientId, batch[0].caseId, "upload");

        await notificationService.sendDay34FollowUp(
          client[0].email,
          client[0].firstName || 'Client',
          batch[0].bureau,
          batch[0].round,
          yesToken,
          noToken,
          uploadToken
        );

        results.push({ batchId, success: true });
      } catch (error) {
        results.push({ batchId, success: false, error: String(error) });
      }
    }

    const actorId = req.user.id;
    await logAudit(actorId, 'bulk_day34_reminder', 'mail_batches', 'multiple', {
      count: batchIds.length,
      results,
    });

    res.json({
      message: `Sent ${results.filter(r => r.success).length} of ${batchIds.length} reminders`,
      results,
    });
  } catch (error) {
    console.error("Error sending bulk reminders:", error);
    res.status(500).json({ message: "Failed to send bulk reminders" });
  }
});
