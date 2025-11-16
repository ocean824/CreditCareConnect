import type { Express } from "express";
import { createServer, type Server } from "http";
import Stripe from "stripe";
import { storage } from "./storage";
import { rateLimit } from "./middleware/rateLimit";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-08-27.basil",
    })
  : null;

if (!stripe) {
  console.warn('⚠️  STRIPE_SECRET_KEY not configured - payment features will be disabled');
}
import { click2mailService } from "./services/click2mail";
import { letterGeneratorService } from "./services/letterGenerator";
import { notificationService } from "./services/notificationService";
import { insertCreditReportSchema, insertViolationSchema, insertDisputeLetterSchema, insertChatConversationSchema, insertCfpbComplaintSchema } from "@shared/schema";
import crypto from "crypto";
import multer from "multer";
import path from "path";
import fs from "fs";
import { z } from "zod";
import { mintActionToken, verifyAndConsumeToken } from "./oneTimeToken";
import { clientResponses, mailBatches, users, deliveryEvents } from "@shared/schema";
import { db } from "./db";
import { ocrPdfOrImage, ollamaGenerate } from "./ocr";
import { eq } from "drizzle-orm";
import { adminRouter } from "./adminRoutes";
import { adminOnly } from "./adminOnly";
import {
  runAllFreezes,
  type FreezeUserInfo,
} from "./services/freezeAgent";
import adminAuthRouter, { getAdminSession } from "./adminAuth";
import userAuthRouter, { requireAuth, requireActiveSubscription } from "./userAuth";

export async function registerRoutes(app: Express): Promise<Server> {
  // Admin password-based auth session (separate from user session)
  app.use("/api/admin", getAdminSession());
  app.use("/admin", getAdminSession());
  
  // Admin password-based auth routes
  app.use(adminAuthRouter);
  
  // User password-based auth routes
  app.use(userAuthRouter);

  // Auth routes - get current user
  app.get('/api/auth/user', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Update user profile
  app.patch('/api/auth/profile', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      
      // Validate input
      const updateProfileSchema = z.object({
        firstName: z.string().min(1).max(100).optional(),
        lastName: z.string().min(1).max(100).optional(),
      });
      
      const validatedData = updateProfileSchema.parse(req.body);
      const { firstName, lastName } = validatedData;

      await db.update(users)
        .set({ 
          firstName, 
          lastName,
          updatedAt: new Date()
        })
        .where(eq(users.id, userId));
      
      const [updatedUser] = await db.select().from(users).where(eq(users.id, userId));
      
      res.json(updatedUser);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error updating profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Client self-info (with role for RBAC)
  app.get('/api/me', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({
        id: user.id,
        email: user.email,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
        role: user.role || 'user'
      });
    } catch (error) {
      console.error("Error fetching user info:", error);
      res.status(500).json({ message: "Failed to fetch user info" });
    }
  });

  // Stripe checkout session creation
  app.post('/api/create-checkout-session', 
    rateLimit({ windowMs: 60_000, max: 5, namespace: 'stripe-checkout' }),
    requireAuth, 
    async (req: any, res) => {
    try {
      if (!stripe) {
        return res.status(503).json({ error: "Payment system is not configured. Please contact support." });
      }
      
      const userId = req.session.userId;
      const user = await storage.getUser(userId);
      
      if (!user || !user.email) {
        return res.status(400).json({ error: "User email required" });
      }

      const { plan, successUrl, cancelUrl } = req.body;

      if (!plan || (plan !== 'DIY' && plan !== 'DONE_FOR_YOU')) {
        return res.status(400).json({ error: "Invalid plan selection" });
      }

      const priceAmount = plan === 'DIY' ? 1995 : 14999;
      const planName = plan === 'DIY' ? 'DIY Mode' : 'Done-For-You';

      const session = await stripe.checkout.sessions.create({
        customer_email: user.email,
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: `Personal Credit Pros - ${planName}`,
                description: plan === 'DIY' 
                  ? 'AI-powered credit report analysis and dispute letter generation'
                  : 'Full-service credit repair with automated mailing and CRM tracking',
              },
              unit_amount: priceAmount,
              recurring: {
                interval: 'month',
              },
            },
            quantity: 1,
          },
        ],
        success_url: successUrl || `${req.protocol}://${req.get('host')}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl || `${req.protocol}://${req.get('host')}/subscribe?canceled=true`,
        metadata: {
          userId: user.id,
          plan: plan,
        },
      });

      res.json({
        success: true,
        url: session.url,
        sessionId: session.id
      });
    } catch (error: any) {
      console.error("Stripe checkout error:", error);
      return res.status(500).json({ error: error.message });
    }
  });

  // Credit Report Analysis
  app.post('/api/credit-reports/upload', 
    rateLimit({ windowMs: 60_000, max: 10, namespace: 'credit-upload' }),
    requireActiveSubscription, 
    async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { fileName, fileUrl, bureau } = req.body;

      // Validate request
      const validatedData = insertCreditReportSchema.parse({
        userId,
        fileName,
        fileUrl,
        bureau,
        analysisStatus: "PENDING"
      });

      const creditReport = await storage.createCreditReport(validatedData);

      // Start analysis in background (simplified for this implementation)
      setTimeout(async () => {
        try {
          // In real implementation, you'd extract text from PDF first
          const mockReportText = "Sample credit report text for analysis...";
          const analysis = {
            violations: [
              {
                accountName: "Test Account",
                accountNumber: "1234567890",
                bureau: bureau || "EQUIFAX",
                violationType: "INACCURATE_INFORMATION",
                description: "Account showing incorrect balance",
                statute: "FCRA Section 611",
                severity: "HIGH"
              },
              {
                accountName: "Credit Card XYZ",
                accountNumber: "9876543210",
                bureau: bureau || "EQUIFAX",
                violationType: "OBSOLETE_INFORMATION",
                description: "Account older than 7 years still being reported",
                statute: "FCRA Section 605",
                severity: "MEDIUM"
              }
            ]
          };
          
          // Update credit report with analysis results
          await storage.updateCreditReportAnalysis(
            creditReport.id, 
            analysis, 
            "COMPLETED"
          );

          // Create violation records
          for (const violation of analysis.violations) {
            await storage.createViolation({
              creditReportId: creditReport.id,
              accountName: violation.accountName,
              accountNumber: violation.accountNumber,
              bureau: violation.bureau,
              violationType: violation.violationType,
              description: violation.description,
              statute: violation.statute,
              severity: violation.severity,
              status: "IDENTIFIED"
            });
          }
          
          console.log(`✓ Analysis completed for report ${creditReport.id}: ${analysis.violations.length} violations created`);
        } catch (error) {
          console.error("Error in background analysis:", error);
          await storage.updateCreditReportAnalysis(creditReport.id, null, "FAILED");
        }
      }, 1500);

      res.json(creditReport);
    } catch (error) {
      console.error("Error uploading credit report:", error);
      res.status(500).json({ message: "Failed to upload credit report" });
    }
  });

  app.get('/api/credit-reports', requireActiveSubscription, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const creditReports = await storage.getCreditReportsByUserId(userId);
      res.json(creditReports);
    } catch (error) {
      console.error("Error fetching credit reports:", error);
      res.status(500).json({ message: "Failed to fetch credit reports" });
    }
  });

  // Violations
  app.get('/api/violations', requireActiveSubscription, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const violations = await storage.getViolationsByUserId(userId);
      res.json(violations);
    } catch (error) {
      console.error("Error fetching violations:", error);
      res.status(500).json({ message: "Failed to fetch violations" });
    }
  });

  // Dispute Letters
  app.post('/api/dispute-letters/generate', requireActiveSubscription, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const user = await storage.getUser(userId);
      
      // Validate input
      const generateLetterSchema = z.object({
        bureau: z.enum(['EQUIFAX', 'TRANSUNION', 'EXPERIAN']),
        violationIds: z.array(z.string()).min(1, "At least one violation must be selected"),
      });
      
      const validatedData = generateLetterSchema.parse(req.body);
      const { bureau, violationIds } = validatedData;

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get violations for letter generation
      const allViolations = await storage.getViolationsByUserId(userId);
      const selectedViolations = allViolations.filter(v => violationIds.includes(v.id));

      if (selectedViolations.length === 0) {
        return res.status(400).json({ message: "No violations selected" });
      }

      // Generate letter using AI
      const clientInfo = {
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Client',
        address: "123 Main Street", // You'd get this from user profile
        city: "Anytown",
        state: "FL",
        zip: "32801",
        dob: "01/01/1990", // You'd get this from user profile
        ssnLast4: "1234" // You'd get this from user profile
      };

      const { letterContent, pdfBuffer } = await letterGeneratorService.generateDisputeLetterPDF(
        selectedViolations.map(v => ({
          accountName: v.accountName,
          accountNumber: v.accountNumber || undefined,
          bureau: v.bureau,
          violationType: v.violationType,
          description: v.description,
          statute: v.statute,
          severity: v.severity
        })),
        bureau,
        clientInfo
      );

      // Save letter to database
      const disputeLetter = await storage.createDisputeLetter({
        userId,
        bureau,
        letterType: "INITIAL",
        content: letterContent,
        pdfUrl: `/api/dispute-letters/${bureau.toLowerCase()}-dispute.pdf`, // Simplified URL
        status: "GENERATED"
      });

      // If user is on Done-For-You plan, automatically send via Click2Mail
      if (user.plan === "DONE_FOR_YOU") {
        try {
          const mailingResult = await click2mailService.sendLetter({
            addressFrom: {
              name: "Personal Credit Pros",
              address1: "123 Business Ave",
              city: "Tampa",
              state: "FL",
              zip: "33601"
            },
            addressTo: {
              name: clientInfo.name,
              address1: clientInfo.address,
              city: clientInfo.city,
              state: clientInfo.state,
              zip: clientInfo.zip
            },
            document: pdfBuffer.toString('base64')
          });

          await storage.updateDisputeLetterStatus(
            disputeLetter.id,
            "SENT",
            mailingResult.jobId
          );
        } catch (mailingError) {
          console.error("Error sending letter via Click2Mail:", mailingError);
          // Letter is still generated, just not sent automatically
        }
      }

      res.json(disputeLetter);
    } catch (error) {
      console.error("Error generating dispute letter:", error);
      res.status(500).json({ message: "Failed to generate dispute letter" });
    }
  });

  app.get('/api/dispute-letters', requireActiveSubscription, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const letters = await storage.getDisputeLettersByUserId(userId);
      res.json(letters);
    } catch (error) {
      console.error("Error fetching dispute letters:", error);
      res.status(500).json({ message: "Failed to fetch dispute letters" });
    }
  });

  app.get('/api/dispute-letters/:id/download', requireActiveSubscription, async (req: any, res) => {
    try {
      const { id } = req.params;
      const letters = await storage.getDisputeLettersByUserId(req.session.userId);
      const letter = letters.find(l => l.id === id);

      if (!letter) {
        return res.status(404).json({ message: "Letter not found" });
      }

      // In a real implementation, you'd retrieve the actual PDF
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${letter.bureau}-dispute-letter.pdf"`);
      res.send(Buffer.from("Sample PDF content"));
    } catch (error) {
      console.error("Error downloading dispute letter:", error);
      res.status(500).json({ message: "Failed to download dispute letter" });
    }
  });

  // AI Chat (stubbed until OpenAI key is configured)
  app.post('/api/chat', requireActiveSubscription, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const user = await storage.getUser(userId);
      const { message, conversationId } = req.body;

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get conversation history
      let conversation;
      let conversationHistory: any[] = [];

      if (conversationId) {
        const conversations = await storage.getChatConversationsByUserId(userId);
        conversation = conversations.find(c => c.id === conversationId);
        if (conversation) {
          conversationHistory = conversation.messages as any[];
        }
      }

      // Get user's violations for context
      const violations = await storage.getViolationsByUserId(userId);

      // Generate AI response (stubbed for now)
      const aiResponse = "I'm here to help with your credit repair questions. This AI feature is currently being configured."

      // Update conversation
      const newMessage = { role: "user", content: message, timestamp: new Date() };
      const aiMessage = { role: "assistant", content: aiResponse, timestamp: new Date() };
      const updatedMessages = [...conversationHistory, newMessage, aiMessage];

      if (conversation) {
        await storage.updateChatConversation(conversation.id, updatedMessages);
      } else {
        conversation = await storage.createChatConversation({
          userId,
          messages: updatedMessages
        });
      }

      res.json({
        conversationId: conversation.id,
        response: aiResponse,
        messages: updatedMessages
      });
    } catch (error) {
      console.error("Error in AI chat:", error);
      res.status(500).json({ message: "Failed to process chat message" });
    }
  });

  // CFPB Complaint Generation
  app.post('/api/cfpb-complaints/generate', requireActiveSubscription, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get user's violations and dispute history
      const violations = await storage.getViolationsByUserId(userId);
      const disputeLetters = await storage.getDisputeLettersByUserId(userId);

      const clientInfo = {
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Client',
        email: user.email
      };

      // Generate CFPB complaint (stubbed for now)
      const complaintText = "Sample CFPB complaint text will be generated here.";
      const caseLawCitations = ["Sample case law citation"];

      // Generate PDF packet
      const pdfBuffer = await letterGeneratorService.generateCFPBPacketPDF(
        complaintText,
        caseLawCitations,
        disputeLetters.map(l => l.bureau + " Dispute Letter")
      );

      // Save to database
      const cfpbComplaint = await storage.createCfpbComplaint({
        userId,
        content: complaintText,
        supporting_documents: disputeLetters.map(l => l.pdfUrl || ""),
        caseLawCitations,
        status: "DRAFT"
      });

      res.json({
        ...cfpbComplaint,
        pdfUrl: `/api/cfpb-complaints/${cfpbComplaint.id}/download`
      });
    } catch (error) {
      console.error("Error generating CFPB complaint:", error);
      res.status(500).json({ message: "Failed to generate CFPB complaint" });
    }
  });

  // Admin Routes (protected by adminOnly middleware)
  app.get('/api/admin/stats', adminOnly, async (req: any, res) => {
    try {
      const stats = await storage.getUserStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching admin stats:", error);
      res.status(500).json({ message: "Failed to fetch admin stats" });
    }
  });

  app.get('/api/admin/users', adminOnly, async (req: any, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // One-time token routes for client responses
  const upload = multer({
    dest: process.env.FILES_DIR || "./files",
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
      const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
      const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf'];
      
      const ext = path.extname(file.originalname).toLowerCase();
      const mimeValid = allowedMimes.includes(file.mimetype);
      const extValid = allowedExts.includes(ext);
      
      if (mimeValid && extValid) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only images (JPG, PNG, GIF, WEBP) and PDFs are allowed.'));
      }
    }
  });

  app.get('/notify/answer', async (req, res) => {
    try {
      const token = req.query.token as string;
      const row = await verifyAndConsumeToken(token);
      
      const answer = row.purpose.includes("yes") ? "YES" : "NO";
      await db.insert(clientResponses).values({
        id: crypto.randomUUID(),
        clientId: row.clientId,
        caseId: row.caseId,
        round: 1,
        fileUrl: `response:${answer}`,
        ocrText: answer,
        createdAt: new Date()
      });

      res.send(`<h2>Thanks! Your answer (${answer}) has been recorded.</h2>`);
    } catch (err: any) {
      res.status(400).send(`<h2>Error: ${err.message}</h2>`);
    }
  });

  app.get('/notify/upload', async (req, res) => {
    const token = req.query.token as string;
    if (!token) return res.status(400).send("Missing token");
    
    res.send(`
      <!DOCTYPE html>
      <html>
      <head><title>Upload Bureau Response</title></head>
      <body>
        <h2>Upload your bureau response letter</h2>
        <form method="POST" action="/notify/upload" enctype="multipart/form-data">
          <input type="hidden" name="token" value="${token}" />
          <input type="file" name="letter" accept="image/*,application/pdf" required />
          <button type="submit">Upload</button>
        </form>
      </body>
      </html>
    `);
  });

  app.post('/notify/upload', 
    rateLimit({ windowMs: 60_000, max: 5, namespace: 'notify-upload' }),
    upload.single('letter'), 
    async (req: any, res) => {
    try {
      const token = req.body.token;
      const row = await verifyAndConsumeToken(token);
      
      if (!req.file) {
        return res.status(400).send("No file uploaded");
      }

      const fileUrl = `/files/${req.file.filename}`;
      const absPath = req.file.path;

      // OCR the uploaded file
      const ocrText = await ocrPdfOrImage(absPath);

      // Analyze with Ollama (optional, can be skipped if Ollama not running)
      let analysisJson: any = null;
      try {
        const prompt = `Analyze this bureau letter response and extract key information:\n\n${ocrText}`;
        const analysisText = await ollamaGenerate("mistral", prompt);
        analysisJson = { analysis: analysisText };
      } catch (e) {
        console.log("Ollama not available, skipping AI analysis");
      }

      // Save to database
      await db.insert(clientResponses).values({
        id: crypto.randomUUID(),
        clientId: row.clientId,
        caseId: row.caseId,
        round: 1,
        fileUrl,
        ocrText,
        analysisJson,
        createdAt: new Date()
      });

      res.send(`<h2>Upload successful! We'll analyze your response and follow up soon.</h2>`);
    } catch (err: any) {
      res.status(400).send(`<h2>Error: ${err.message}</h2>`);
    }
  });

  /**
   * Submit freeze and opt-out requests on behalf of the authenticated user.
   *
   * This endpoint accepts a JSON body with the consumer's personal
   * information required by credit bureaus and consumer reporting agencies.
   * The request is processed asynchronously using Puppeteer to navigate
   * multiple external websites and submit the required forms. Because these
   * flows may include CAPTCHAs or human verification, the agent will make
   * best efforts but may fail if automated completion is not possible. In
   * that case the response will include an error message and the user should
   * complete the freeze manually.
   *
   * Body parameters:
   * - firstName (string, required)
   * - lastName (string, required)
   * - address (string, required)
   * - city (string, required)
   * - state (string, required; two-letter code)
   * - zip (string, required)
   * - ssn (string, optional)
   * - dob (string, optional; YYYY-MM-DD)
   * - phone (string, optional)
   * - email (string, optional)
   */
  app.post('/api/freeze-opt-out', 
    rateLimit({ windowMs: 3_600_000, max: 3, namespace: 'freeze-optout' }), // 3 requests per hour
    requireActiveSubscription, 
    async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Validate input
      const freezeSchema = z.object({
        firstName: z.string().min(1).max(100),
        lastName: z.string().min(1).max(100),
        address: z.string().min(1).max(200),
        city: z.string().min(1).max(100),
        state: z.string().length(2, "State must be a 2-letter code"),
        zip: z.string().regex(/^\d{5}$/, "ZIP must be 5 digits"),
        ssn: z.string().regex(/^\d{3}-?\d{2}-?\d{4}$/, "Invalid SSN format").optional(),
        dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date of birth must be YYYY-MM-DD").optional(),
        phone: z.string().min(10).max(15).optional(),
        email: z.string().email().optional(),
      });
      
      const validatedData = freezeSchema.parse(req.body);
      const {
        firstName,
        lastName,
        address,
        city,
        state,
        zip,
        ssn,
        dob,
        phone,
        email,
      } = validatedData;
      const info: FreezeUserInfo = {
        firstName,
        lastName,
        address,
        city,
        state,
        zip,
        ssn,
        dob,
        phone,
        email: email || user.email || undefined,
      };
      // Run all freeze and opt-out flows in the background
      runAllFreezes(info)
        .then(() => {
          console.log(`[freeze-agent] All freezes completed for user ${userId}`);
        })
        .catch((err) => {
          console.error(`[freeze-agent] Error running freezes for user ${userId}:`, err);
        });
      res.json({
        message: 'Freeze and opt-out requests submitted. This may take a few minutes to complete.',
        status: 'processing',
      });
    } catch (err: any) {
      console.error('Error in freeze-opt-out endpoint:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Mount admin routes
  app.use('/api/admin', adminRouter);

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'healthy',
      timestamp: new Date().toISOString()
    });
  });

  const httpServer = createServer(app);
  return httpServer;
}
