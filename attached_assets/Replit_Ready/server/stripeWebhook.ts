import express, { type Express } from "express";
import Stripe from "stripe";
import { storage } from "./storage";
import { notificationService } from "./services/notificationService";

const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-08-27.basil',
    })
  : null;

export function registerStripeWebhook(app: Express) {
  app.post(
    '/api/stripe/webhook',
    express.raw({ type: 'application/json' }),
    async (req, res) => {
      if (!stripe) {
        console.error('Stripe not configured - STRIPE_SECRET_KEY missing');
        return res.status(503).send('Stripe not configured');
      }

      const sig = req.headers['stripe-signature'];
      if (!sig) {
        console.error('Missing stripe-signature header');
        return res.status(400).send('Missing stripe-signature header');
      }

      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET_SNAPSHOT || 
                           process.env.STRIPE_WEBHOOK_SECRET_THIN;

      if (!webhookSecret) {
        console.error('Stripe webhook secret not configured - add STRIPE_WEBHOOK_SECRET_SNAPSHOT or STRIPE_WEBHOOK_SECRET_THIN');
        return res.status(503).send('Webhook secret not configured');
      }

      let event: Stripe.Event;

      try {
        event = stripe.webhooks.constructEvent(
          req.body,
          sig,
          webhookSecret
        );
      } catch (err: any) {
        console.error('❌ Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }

      console.log(`✓ Stripe webhook received: ${event.type}`);

      try {
        switch (event.type) {
          case 'checkout.session.completed': {
            const session = event.data.object as Stripe.Checkout.Session;
            const customerEmail = session.customer_email || session.customer_details?.email;
            const customerId = session.customer as string;
            const subscriptionId = session.subscription as string;

            if (customerEmail && customerId) {
              const user = await storage.getUserByEmail(customerEmail);
              if (user) {
                await storage.updateUserStripeInfo(user.id, customerId, subscriptionId);
                await storage.updateUserPlan(user.id, "DONE_FOR_YOU");
                console.log(`✓ User ${user.email} upgraded to DONE_FOR_YOU via Stripe`);
                
                if (user.email) {
                  await notificationService.sendUpgradeConfirmation(
                    user.email,
                    user.firstName || 'User'
                  );
                }
              }
            }
            break;
          }

          case 'invoice.paid': {
            const invoice = event.data.object as Stripe.Invoice;
            const customerEmail = invoice.customer_email;
            
            if (customerEmail) {
              const user = await storage.getUserByEmail(customerEmail);
              if (user) {
                console.log(`✓ Invoice paid for user ${user.email}`);
              }
            }
            break;
          }

          case 'invoice.payment_failed': {
            const invoice = event.data.object as Stripe.Invoice;
            const customerEmail = invoice.customer_email;
            
            if (customerEmail) {
              const user = await storage.getUserByEmail(customerEmail);
              if (user && user.email) {
                console.log(`⚠ Payment failed for user ${user.email}`);
              }
            }
            break;
          }

          case 'customer.subscription.deleted': {
            const subscription = event.data.object as Stripe.Subscription;
            const customerId = subscription.customer as string;
            
            const users = await storage.getAllUsers();
            const user = users.find(u => u.stripeCustomerId === customerId);
            
            if (user) {
              await storage.updateUserPlan(user.id, "DIY");
              console.log(`✓ User ${user.email} downgraded to DIY due to subscription cancellation`);
            }
            break;
          }

          default:
            console.log(`Unhandled Stripe event type: ${event.type}`);
        }

        res.json({ received: true });
      } catch (error) {
        console.error('❌ Error processing webhook:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
      }
    }
  );
}
