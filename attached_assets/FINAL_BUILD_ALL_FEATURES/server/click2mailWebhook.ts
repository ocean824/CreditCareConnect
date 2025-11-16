import express, { type Express } from "express";
import crypto from "crypto";
import { db } from "./db";
import { mailBatches, deliveryEvents, users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { notificationService } from "./services/notificationService";

export function registerClick2MailWebhook(app: Express) {
  app.post(
    '/webhooks/click2mail',
    express.raw({ type: 'application/json' }),
    async (req, res) => {
      try {
        // Verify that we received a raw buffer body
        if (!Buffer.isBuffer(req.body)) {
          console.warn('Webhook received non-buffer body - content-type may be incorrect');
          return res.status(415).json({ error: 'Unsupported Media Type - expected application/json' });
        }

        // Verify webhook authenticity using shared secret
        const webhookSecret = process.env.CLICK2MAIL_WEBHOOK_SECRET;
        if (webhookSecret) {
          const signature = req.headers['x-click2mail-signature'] as string;
          
          if (!signature) {
            console.warn('Missing x-click2mail-signature header');
            return res.status(401).json({ error: 'Unauthorized - missing signature' });
          }

          // Compute HMAC of raw body
          const computedSignature = crypto
            .createHmac('sha256', webhookSecret)
            .update(req.body)
            .digest('hex');
          
          if (signature !== computedSignature) {
            console.warn('Invalid webhook signature');
            return res.status(401).json({ error: 'Unauthorized - invalid signature' });
          }
        } else {
          console.warn('CLICK2MAIL_WEBHOOK_SECRET not configured - webhook is unauthenticated');
        }

        // Parse the JSON body
        const body = JSON.parse(req.body.toString());
        const { jobId, event, tracking, proofUrl } = body;
        
        // Validate inputs
        if (!jobId || !event) {
          return res.status(400).json({ error: 'Missing required fields: jobId and event' });
        }
        
        // Find the mail batch
        const batches = await db.select().from(mailBatches).where(eq(mailBatches.click2mailJobId, jobId));
        const batch = batches[0];
        
        if (batch) {
          // Record delivery event
          await db.insert(deliveryEvents).values({
            id: crypto.randomUUID(),
            batchId: batch.id,
            kind: event,
            payload: body,
            createdAt: new Date()
          });

          // Update batch status and tracking info
          const updates: any = {};
          if (tracking) updates.uspsTracking = tracking;
          if (proofUrl) updates.proofUrl = proofUrl;
          if (event === "delivered") updates.status = "delivered";
          else if (event === "in_transit") updates.status = "in_transit";

          if (Object.keys(updates).length > 0) {
            await db.update(mailBatches).set(updates).where(eq(mailBatches.id, batch.id));
          }

          // Notify client if delivered with proof
          if (proofUrl && batch.clientId) {
            const client = (await db.select().from(users).where(eq(users.id, batch.clientId)))[0];
            if (client?.email) {
              await notificationService.sendEmail(
                client.email,
                "Dispute Letter Delivered",
                `Your dispute letter to ${batch.bureau} has been delivered. <a href="${proofUrl}">View proof of delivery</a>`
              );
            }
          }
        }

        res.json({ success: true });
      } catch (err: any) {
        console.error("Click2Mail webhook error:", err);
        res.status(500).json({ error: err.message });
      }
    }
  );
}
