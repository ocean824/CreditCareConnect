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
import userAuthRouter, { requireAuth, requireActiveSubscription, getUserSession } from "./userAuth";
import { analyzeWithRulesEngine } from "./services/advancedCreditAnalysis";
import { parseCreditReportText } from "./services/creditReportParser";
import { parseMetro2File, isMetro2File, convertMetro2ToCreditReport } from "./services/metro2Parser";
import { extractReportText, detectReportFormat, isTextQualitySufficient, type ExtractionResult } from "./services/extraction";
import { draftAiDisputeLetter, convertIssuesToViolationSummaries } from "./services/aiLetterDrafting";
import { nanoid } from "nanoid";

// Build version - update this when deploying to track which version is live
const BUILD_VERSION = "2025-12-03-v3";
const BUILD_TIMESTAMP = new Date().toISOString();

export async function registerRoutes(app: Express): Promise<Server> {
  // Version endpoint to verify deployment
  app.get('/api/version', (req, res) => {
    res.json({
      version: BUILD_VERSION,
      buildTime: BUILD_TIMESTAMP,
      environment: process.env.NODE_ENV || 'unknown',
      features: ['force-reanalyze', 'diagnostic-endpoint', 'v2-parser']
    });
  });

  // User session middleware (for all routes)
  app.use(getUserSession());
  
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

  // File upload endpoint for credit reports
  const creditReportUpload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        const filesDir = process.env.FILES_DIR || "./files";
        // Ensure directory exists
        if (!fs.existsSync(filesDir)) {
          fs.mkdirSync(filesDir, { recursive: true });
        }
        cb(null, filesDir);
      },
      filename: (req, file, cb) => {
        // Generate a unique filename while preserving the extension
        const ext = path.extname(file.originalname).toLowerCase();
        const uniqueName = `${crypto.randomUUID()}${ext}`;
        cb(null, uniqueName);
      }
    }),
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
      const allowedMimes = ['application/pdf', 'image/jpeg', 'image/png'];
      const allowedExts = ['.pdf', '.jpg', '.jpeg', '.png'];
      
      const ext = path.extname(file.originalname).toLowerCase();
      const mimeValid = allowedMimes.includes(file.mimetype);
      const extValid = allowedExts.includes(ext);
      
      if (mimeValid && extValid) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only PDF and image files are allowed.'));
      }
    }
  });

  app.post('/api/upload-file',
    rateLimit({ windowMs: 60_000, max: 10, namespace: 'file-upload' }),
    requireActiveSubscription,
    creditReportUpload.single('file'),
    async (req: any, res) => {
      console.log(`📤 [upload-file] Handler reached, file: ${req.file?.originalname || 'NONE'}`);
      try {
        if (!req.file) {
          console.log(`📤 [upload-file] No file in request`);
          return res.status(400).json({ message: "No file uploaded" });
        }

        // Multer saves with a hashed filename - we need to return the actual saved filename
        const savedFileName = path.basename(req.file.path);
        const fileUrl = `/files/${savedFileName}`;
        
        res.json({
          fileName: savedFileName,  // Return the actual saved filename, not originalname
          originalName: req.file.originalname,  // Keep original for display purposes
          fileUrl,
          fileSize: req.file.size,
          mimeType: req.file.mimetype
        });
      } catch (error: any) {
        console.error("File upload error:", error);
        res.status(500).json({ message: "File upload failed" });
      }
    }
  );

  // Credit Report Analysis
  app.post('/api/credit-reports/upload', 
    rateLimit({ windowMs: 60_000, max: 10, namespace: 'credit-upload' }),
    requireActiveSubscription, 
    async (req: any, res) => {
    console.log(`📊 [credit-reports/upload] Handler reached`);
    console.log(`   Body: ${JSON.stringify(req.body)}`);
    try {
      const userId = req.session.userId;
      const { fileName, fileUrl, bureau } = req.body;
      console.log(`   userId: ${userId}, fileName: ${fileName}, bureau: ${bureau}`);

      // Validate request
      const validatedData = insertCreditReportSchema.parse({
        userId,
        fileName,
        fileUrl,
        bureau,
        analysisStatus: "PENDING"
      });

      const creditReport = await storage.createCreditReport(validatedData);

      // Run advanced analysis synchronously before sending response
      let analysisRun;
      try {
        // Create analysis run record
        analysisRun = await storage.createAnalysisRun({
          creditReportId: creditReport.id,
          engineVersion: "1.0.0",
          aiModel: process.env.OPENAI_MODEL || "gpt-5.1-chat-latest",
          status: "running",
        });

        // Download and parse the uploaded credit report
        console.log(`📄 Analyzing credit report: ${fileName}`);
        
        // Determine the file path from fileUrl ONLY (don't trust client-provided fileName)
        const filesDir = process.env.FILES_DIR || "./files";
        
        let filePath;
        let isLocalFile = false;
        
        // Check if fileUrl is a relative path (local file) or absolute URL (remote/local file)
        // Only treat it as local if it's a relative path starting with /files/
        if (fileUrl.startsWith('/files/')) {
          isLocalFile = true;
          // Extract the filename from the relative URL
          const localFileName = path.basename(fileUrl);
          
          // SECURITY: Sanitize fileName to prevent path traversal attacks
          const sanitizedFileName = localFileName.replace(/[^a-zA-Z0-9._-]/g, '_');
          if (!sanitizedFileName || sanitizedFileName === '.' || sanitizedFileName === '..') {
            throw new Error('Invalid file name');
          }
          
          filePath = path.join(filesDir, sanitizedFileName);
          console.log(`📁 Using local file: ${filePath}`);
        } else {
          // URL (could be remote or localhost) - prepare to download it
          // Extract extension from pathname (not full URL) to avoid query params
          let fileExt = '.pdf'; // Default to PDF
          try {
            const parsedUrl = new URL(fileUrl);
            const pathname = parsedUrl.pathname;
            const extFromPath = path.extname(pathname).toLowerCase();
            // Only use if it's a valid extension
            if (['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(extFromPath)) {
              fileExt = extFromPath;
            }
          } catch (e) {
            // If URL parsing fails, fallback to PDF
            console.warn('Failed to parse fileUrl for extension, using .pdf');
          }
          
          const downloadFileName = `${crypto.randomUUID()}${fileExt}`;
          filePath = path.join(filesDir, downloadFileName);
        }
        
        // Check if file exists locally, if not and it's a remote URL, download it
        if (!fs.existsSync(filePath) && !isLocalFile) {
          console.log(`📥 Downloading file from ${fileUrl}...`);
          
          // SECURITY: Validate fileUrl to prevent SSRF attacks
          let parsedUrl;
          try {
            parsedUrl = new URL(fileUrl);
          } catch (e) {
            throw new Error('Invalid file URL');
          }
          
          // Only allow HTTPS and block private IPs
          if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
            throw new Error('Only HTTP/HTTPS URLs are allowed');
          }
          
          // Block private IP ranges and localhost
          const hostname = parsedUrl.hostname.toLowerCase();
          if (
            hostname === 'localhost' ||
            hostname === '127.0.0.1' ||
            hostname.startsWith('192.168.') ||
            hostname.startsWith('10.') ||
            hostname.startsWith('172.16.') ||
            hostname.startsWith('172.17.') ||
            hostname.startsWith('172.18.') ||
            hostname.startsWith('172.19.') ||
            hostname.startsWith('172.20.') ||
            hostname.startsWith('172.21.') ||
            hostname.startsWith('172.22.') ||
            hostname.startsWith('172.23.') ||
            hostname.startsWith('172.24.') ||
            hostname.startsWith('172.25.') ||
            hostname.startsWith('172.26.') ||
            hostname.startsWith('172.27.') ||
            hostname.startsWith('172.28.') ||
            hostname.startsWith('172.29.') ||
            hostname.startsWith('172.30.') ||
            hostname.startsWith('172.31.') ||
            hostname.startsWith('169.254.') ||
            hostname === '[::1]'
          ) {
            throw new Error('Access to private networks is not allowed');
          }
          
          try {
            // Ensure the files directory exists
            if (!fs.existsSync(filesDir)) {
              fs.mkdirSync(filesDir, { recursive: true });
            }
            
            // Download the file with timeout
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout
            
            const response = await fetch(fileUrl, { 
              signal: controller.signal,
              redirect: 'follow',
              headers: {
                'User-Agent': 'PersonalCreditPros/1.0'
              }
            });
            clearTimeout(timeout);
            
            if (!response.ok) {
              throw new Error(`Failed to download file: ${response.statusText}`);
            }
            
            // Limit file size to 50MB
            const contentLength = response.headers.get('content-length');
            if (contentLength && parseInt(contentLength) > 50 * 1024 * 1024) {
              throw new Error('File size exceeds 50MB limit');
            }
            
            const buffer = await response.arrayBuffer();
            
            // Write the file to disk
            fs.writeFileSync(filePath, Buffer.from(buffer), { mode: 0o600 }); // Restrict permissions
            console.log(`✅ Downloaded file to ${filePath}`);
          } catch (downloadError: any) {
            console.error(`❌ Download failed:`, downloadError.message);
            throw new Error(`Failed to download credit report: ${downloadError.message}`);
          }
        }
        
        // Extract text from PDF using OCR
        let reportText = "";
        try {
          console.log(`🔍 Extracting text from ${filePath}...`);
          reportText = await ocrPdfOrImage(filePath);
          console.log(`✅ Extracted ${reportText.length} characters from credit report`);
        } catch (ocrError: any) {
          console.error(`❌ OCR failed:`, ocrError.message);
          throw new Error(`Failed to extract text from credit report: ${ocrError.message}`);
        }
        
        // Parse the text into a structured CreditReport object using AI (tri-merge capable)
        let parsedReport;
        try {
          console.log(`🤖 Parsing credit report with AI (tri-merge enabled)...`);
          const { parseCreditReportWithAiOnly } = await import('./services/creditReportParserV2');
          const triMergeReport = await parseCreditReportWithAiOnly({
            rawText: reportText,
            bureauHint: (bureau || 'TRI') as any,
            provider: 'IDENTITYIQ',
            userId: userId,
          });
          
          // Convert tri-merge format to legacy format for compatibility
          const { convertTriMergeToLegacy } = await import('./services/convertTriMergeToLegacy');
          parsedReport = convertTriMergeToLegacy(triMergeReport);
          
          // Log parsing results
          const bureauCount = parsedReport.bureaus.length;
          const tradelineCount = parsedReport.bureaus.reduce((sum, b) => sum + b.tradelines.length, 0);
          const collectionCount = parsedReport.bureaus.reduce((sum, b) => sum + b.collections.length, 0);
          console.log(`✅ Successfully parsed credit report:`);
            console.log(`   📊 Bureaus: ${bureauCount}, Tradelines: ${tradelineCount}, Collections: ${collectionCount}`);
        } catch (parseError: any) {
          console.error(`❌ Parsing failed:`, parseError.message);
          throw new Error(`Failed to parse credit report: ${parseError.message}`);
        }
        
        // Run advanced analysis (rules engine + AI explanations)
        console.log(`🔬 Running rules engine analysis...`);
        const analysisResult = await analyzeWithRulesEngine(parsedReport);
        console.log(`✅ Rules engine analysis complete: ${analysisResult.issues.length} issues detected`);
        
        // Save issues to database
        for (const issue of analysisResult.issues) {
          await storage.createIssue({
            runId: analysisRun.id,
            issueId: issue.id,
            ruleId: issue.ruleId,
            family: issue.family,
            category: issue.category,
            severity: issue.severity,
            affectedEntityType: issue.affectedEntityType,
            affectedBureaus: issue.affectedBureaus,
            affectedIds: issue.affectedIds,
            statutes: issue.statutes,
            descriptionMachine: issue.descriptionMachine,
            explanationKey: issue.explanationKey,
            details: issue.details as any,
          });
        }
        
        // Save AI explanations to database
        for (const explanation of analysisResult.aiExplanations) {
          await storage.createAiIssueExplanation({
            runId: analysisRun.id,
            issueId: explanation.issueId,
            accountLabel: explanation.accountLabel,
            humanSummary: explanation.humanSummary,
            statutes: explanation.statutes,
            disputeAngle: explanation.disputeAngle,
            recommendedAction: explanation.recommendedAction,
            priority: explanation.priority,
            rawAiPayload: explanation,
          });
        }
        
        // Update analysis run status
        await storage.updateAnalysisRunStatus(
          analysisRun.id,
          "completed",
          new Date(),
          analysisResult.issues.length,
          analysisResult.aiExplanations.length
        );

        // Update credit report with analysis results (for backwards compatibility)
        const legacyAnalysis = {
          violations: analysisResult.issues.slice(0, 10).map(issue => ({
            accountName: (issue.details as any).accountName || "Account",
            accountNumber: issue.affectedIds[0] || "N/A",
            bureau: issue.affectedBureaus?.[0] || bureau || "EQUIFAX",
            violationType: issue.category,
            description: issue.descriptionMachine,
            statute: issue.statutes.join(", "),
            severity: issue.severity,
          })),
          summary: analysisResult.summary,
        };
        
        await storage.updateCreditReportAnalysis(
          creditReport.id, 
          legacyAnalysis, 
          "COMPLETED"
        );

        // Create legacy violation records (for backwards compatibility)
        for (const violation of legacyAnalysis.violations) {
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
          
        console.log(`✅ Advanced analysis completed for report ${creditReport.id}:`);
        console.log(`   📊 ${analysisResult.issues.length} issues detected`);
        console.log(`   🤖 ${analysisResult.aiExplanations.length} AI explanations generated`);
        console.log(`   💾 Saved to analysis run ${analysisRun.id}`);
      } catch (analysisError: any) {
        console.error("❌ Error in advanced analysis:", analysisError);
        if (analysisRun) {
          await storage.updateAnalysisRunStatus(analysisRun.id, "failed");
        }
        await storage.updateCreditReportAnalysis(creditReport.id, null, "FAILED");
        
        // Return error response instead of swallowing the error!
        return res.status(500).json({ 
          message: `Credit report analysis failed: ${analysisError.message}`,
          code: "ANALYSIS_FAILED",
          creditReportId: creditReport.id 
        });
      }

      // Only send success response if analysis actually completed
      console.log(`✅ Credit report upload and analysis completed successfully for report ${creditReport.id}`);
      res.json(creditReport);
    } catch (error: any) {
      console.error("❌ Error uploading credit report:", error);
      console.error("   Stack:", error.stack);
      res.status(500).json({ 
        message: error.message || "Failed to upload credit report",
        code: "UPLOAD_FAILED" 
      });
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

  // Delete credit report
  app.delete('/api/credit-reports/:id', requireActiveSubscription, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const reportId = req.params.id;
      
      // Get the credit report to verify ownership
      const reports = await storage.getCreditReportsByUserId(userId);
      const creditReport = reports.find(r => r.id === reportId);
      
      if (!creditReport) {
        return res.status(404).json({ message: "Credit report not found" });
      }
      
      // Delete the file if it exists locally
      if (creditReport.fileUrl.startsWith('/files/')) {
        const localFileName = path.basename(creditReport.fileUrl);
        const sanitizedFileName = localFileName.replace(/[^a-zA-Z0-9._-]/g, '_');
        const filesDir = process.env.FILES_DIR || "./files";
        const filePath = path.join(filesDir, sanitizedFileName);
        
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`🗑️  Deleted file: ${filePath}`);
          }
        } catch (error) {
          console.error(`⚠️  Failed to delete file: ${filePath}`, error);
        }
      }
      
      // Delete from database (cascade deletes violations, analysis runs, etc.)
      await storage.deleteCreditReport(reportId);
      console.log(`✅ Deleted credit report ${reportId}`);
      
      res.json({ message: "Credit report deleted successfully" });
    } catch (error) {
      console.error("Error deleting credit report:", error);
      res.status(500).json({ message: "Failed to delete credit report" });
    }
  });

  // Reprocess credit report (for FAILED or PENDING reports)
  app.post('/api/credit-reports/:id/reprocess', requireActiveSubscription, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const reportId = req.params.id;
      
      // Get the credit report
      const reports = await storage.getCreditReportsByUserId(userId);
      const creditReport = reports.find(r => r.id === reportId);
      
      if (!creditReport) {
        return res.status(404).json({ message: "Credit report not found" });
      }
      
      // Only allow reprocessing of FAILED or PENDING reports
      if (creditReport.analysisStatus === "COMPLETED") {
        return res.status(400).json({ message: "Report already analyzed. Upload a new report instead." });
      }
      
      // Update status to PENDING
      await storage.updateCreditReportAnalysis(creditReport.id, null, "PENDING");
      
      // Trigger analysis (same logic as upload endpoint)
      setTimeout(async () => {
        let analysisRun;
        try {
          analysisRun = await storage.createAnalysisRun({
            creditReportId: creditReport.id,
            engineVersion: "1.0.0",
            aiModel: process.env.OPENAI_MODEL || "gpt-5.1-chat-latest",
            status: "running",
          });

          console.log(`🔄 Reprocessing credit report: ${creditReport.fileName}`);
          
          const filesDir = process.env.FILES_DIR || "./files";
          let filePath;
          
          if (!creditReport.fileUrl.startsWith('/files/')) {
            throw new Error("Cannot reprocess remote files. File must be stored locally.");
          }
          
          const localFileName = path.basename(creditReport.fileUrl);
          const sanitizedFileName = localFileName.replace(/[^a-zA-Z0-9._-]/g, '_');
          filePath = path.join(filesDir, sanitizedFileName);
          console.log(`📁 Using local file: ${filePath}`);
          
          if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}. Please re-upload the credit report.`);
          }
          
          // Extract text from PDF
          console.log(`🔍 Extracting text from ${filePath}...`);
          const reportText = await ocrPdfOrImage(filePath);
          console.log(`✅ Extracted ${reportText.length} characters from credit report`);
          
          // Parse with AI (use V2 parser with improved date extraction)
          console.log(`🤖 Parsing credit report with AI V2...`);
          const { parseCreditReportWithAiOnly } = await import('./services/creditReportParserV2');
          const triMergeReport = await parseCreditReportWithAiOnly({
            rawText: reportText,
            bureauHint: (creditReport.bureau || 'TRI') as any,
            provider: 'IDENTITYIQ',
            userId: creditReport.userId,
          });
          
          // Convert to legacy format for rules engine
          const { convertTriMergeToLegacy } = await import('./services/convertTriMergeToLegacy');
          const parsedReport = convertTriMergeToLegacy(triMergeReport);
          
          const bureauCount = parsedReport.bureaus.length;
          const tradelineCount = parsedReport.bureaus.reduce((sum, b) => sum + b.tradelines.length, 0);
          const collectionCount = parsedReport.bureaus.reduce((sum, b) => sum + b.collections.length, 0);
          console.log(`✅ Parsed: ${bureauCount} bureaus, ${tradelineCount} tradelines, ${collectionCount} collections`);
          
          // Run analysis
          console.log(`🔬 Running rules engine analysis...`);
          const analysisResult = await analyzeWithRulesEngine(parsedReport);
          console.log(`✅ Analysis complete: ${analysisResult.issues.length} issues detected`);
          
          // Save issues
          for (const issue of analysisResult.issues) {
            await storage.createIssue({
              runId: analysisRun.id,
              issueId: issue.id,
              ruleId: issue.ruleId,
              family: issue.family,
              category: issue.category,
              severity: issue.severity,
              affectedEntityType: issue.affectedEntityType,
              affectedBureaus: issue.affectedBureaus,
              affectedIds: issue.affectedIds,
              statutes: issue.statutes,
              descriptionMachine: issue.descriptionMachine,
              explanationKey: issue.explanationKey,
              details: issue.details as any,
            });
          }
          
          // Save AI explanations
          for (const explanation of analysisResult.aiExplanations) {
            await storage.createAiIssueExplanation({
              runId: analysisRun.id,
              issueId: explanation.issueId,
              accountLabel: explanation.accountLabel,
              humanSummary: explanation.humanSummary,
              statutes: explanation.statutes,
              disputeAngle: explanation.disputeAngle,
              recommendedAction: explanation.recommendedAction,
              priority: explanation.priority,
              rawAiPayload: explanation,
            });
          }
          
          await storage.updateAnalysisRunStatus(
            analysisRun.id,
            "completed",
            new Date(),
            analysisResult.issues.length,
            analysisResult.aiExplanations.length
          );

          // Create legacy violation records
          const legacyAnalysis = {
            violations: analysisResult.issues.slice(0, 10).map(issue => ({
              accountName: (issue.details as any).accountName || "Account",
              accountNumber: issue.affectedIds[0] || "N/A",
              bureau: issue.affectedBureaus?.[0] || creditReport.bureau || "EQUIFAX",
              violationType: issue.category,
              description: issue.descriptionMachine,
              statute: issue.statutes.join(", "),
              severity: issue.severity,
            })),
            summary: analysisResult.summary,
          };
          
          await storage.updateCreditReportAnalysis(creditReport.id, legacyAnalysis, "COMPLETED");

          for (const violation of legacyAnalysis.violations) {
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
          
          console.log(`✅ Reprocessing completed for ${creditReport.id}`);
        } catch (error) {
          console.error("❌ Error reprocessing credit report:", error);
          if (analysisRun) {
            await storage.updateAnalysisRunStatus(analysisRun.id, "failed");
          }
          await storage.updateCreditReportAnalysis(creditReport.id, null, "FAILED");
        }
      }, 1000);
      
      res.json({ message: "Reprocessing started", reportId: creditReport.id });
    } catch (error) {
      console.error("Error reprocessing credit report:", error);
      res.status(500).json({ message: "Failed to reprocess credit report" });
    }
  });

  // Force re-analyze a credit report (even if already completed)
  // This is needed to recover from cases where the old buggy code ran analysis but found 0 violations
  app.post('/api/credit-reports/:id/force-reanalyze', requireActiveSubscription, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const reportId = req.params.id;
      
      // Get the credit report
      const reports = await storage.getCreditReportsByUserId(userId);
      const creditReport = reports.find(r => r.id === reportId);
      
      if (!creditReport) {
        return res.status(404).json({ message: "Credit report not found" });
      }
      
      console.log(`🔄 Force re-analyzing credit report: ${creditReport.fileName} (ID: ${reportId})`);
      
      // Delete existing violations and analysis data for this report
      try {
        await storage.deleteViolationsByReportId(creditReport.id);
        console.log(`🗑️  Deleted existing violations for report ${creditReport.id}`);
      } catch (e) {
        console.log(`⚠️  No existing violations to delete`);
      }
      
      try {
        await storage.deleteAnalysisDataByReportId(creditReport.id);
        console.log(`🗑️  Deleted existing analysis data for report ${creditReport.id}`);
      } catch (e) {
        console.log(`⚠️  No existing analysis data to delete`);
      }
      
      // Update status to PENDING
      await storage.updateCreditReportAnalysis(creditReport.id, null, "PENDING");
      
      // Run analysis in background
      let analysisRun: any;
      try {
        analysisRun = await storage.createAnalysisRun({
          creditReportId: creditReport.id,
          engineVersion: "1.0.0",
          aiModel: process.env.OPENAI_MODEL || "gpt-5.1-chat-latest",
          status: "running",
        });

        const filesDir = process.env.FILES_DIR || "./files";
        let filePath;
        
        if (!creditReport.fileUrl.startsWith('/files/')) {
          throw new Error("Cannot reprocess remote files. File must be stored locally.");
        }
        
        const localFileName = path.basename(creditReport.fileUrl);
        const sanitizedFileName = localFileName.replace(/[^a-zA-Z0-9._-]/g, '_');
        filePath = path.join(filesDir, sanitizedFileName);
        console.log(`📁 Using local file: ${filePath}`);
        
        if (!fs.existsSync(filePath)) {
          throw new Error(`File not found: ${filePath}. Please re-upload the credit report.`);
        }
        
        // Extract text from PDF
        console.log(`🔍 Extracting text from ${filePath}...`);
        const reportText = await ocrPdfOrImage(filePath);
        console.log(`✅ Extracted ${reportText.length} characters from credit report`);
        
        // Parse with AI (use V2 parser with improved date extraction)
        console.log(`🤖 Parsing credit report with AI V2...`);
        const { parseCreditReportWithAiOnly } = await import('./services/creditReportParserV2');
        const triMergeReport = await parseCreditReportWithAiOnly({
          rawText: reportText,
          bureauHint: (creditReport.bureau || 'TRI') as any,
          provider: 'IDENTITYIQ',
          userId: creditReport.userId,
        });
        
        // Convert to legacy format for rules engine
        const { convertTriMergeToLegacy } = await import('./services/convertTriMergeToLegacy');
        const parsedReport = convertTriMergeToLegacy(triMergeReport);
        
        const bureauCount = parsedReport.bureaus.length;
        const tradelineCount = parsedReport.bureaus.reduce((sum: number, b: any) => sum + b.tradelines.length, 0);
        const collectionCount = parsedReport.bureaus.reduce((sum: number, b: any) => sum + b.collections.length, 0);
        console.log(`✅ Parsed: ${bureauCount} bureaus, ${tradelineCount} tradelines, ${collectionCount} collections`);
        
        // Run analysis
        console.log(`🔬 Running rules engine analysis...`);
        const analysisResult = await analyzeWithRulesEngine(parsedReport);
        console.log(`✅ Analysis complete: ${analysisResult.issues.length} issues detected`);
        
        // Save issues
        for (const issue of analysisResult.issues) {
          await storage.createIssue({
            runId: analysisRun.id,
            issueId: issue.id,
            ruleId: issue.ruleId,
            family: issue.family,
            category: issue.category,
            severity: issue.severity,
            affectedEntityType: issue.affectedEntityType,
            affectedBureaus: issue.affectedBureaus,
            affectedIds: issue.affectedIds,
            statutes: issue.statutes,
            descriptionMachine: issue.descriptionMachine,
            explanationKey: issue.explanationKey,
            details: issue.details as any,
          });
        }
        
        // Save AI explanations
        for (const explanation of analysisResult.aiExplanations) {
          await storage.createAiIssueExplanation({
            runId: analysisRun.id,
            issueId: explanation.issueId,
            accountLabel: explanation.accountLabel,
            humanSummary: explanation.humanSummary,
            statutes: explanation.statutes,
            disputeAngle: explanation.disputeAngle,
            recommendedAction: explanation.recommendedAction,
            priority: explanation.priority,
            rawAiPayload: explanation,
          });
        }
        
        await storage.updateAnalysisRunStatus(
          analysisRun.id,
          "completed",
          new Date(),
          analysisResult.issues.length,
          analysisResult.aiExplanations.length
        );

        // Create legacy violation records
        const legacyAnalysis = {
          violations: analysisResult.issues.slice(0, 10).map(issue => ({
            accountName: (issue.details as any).accountName || "Account",
            accountNumber: issue.affectedIds[0] || "N/A",
            bureau: issue.affectedBureaus?.[0] || creditReport.bureau || "EQUIFAX",
            violationType: issue.category,
            description: issue.descriptionMachine,
            statute: issue.statutes.join(", "),
            severity: issue.severity,
          })),
          summary: analysisResult.summary,
        };
        
        await storage.updateCreditReportAnalysis(creditReport.id, legacyAnalysis, "COMPLETED");

        for (const violation of legacyAnalysis.violations) {
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
        
        console.log(`✅ Force re-analysis completed for ${creditReport.id}: ${analysisResult.issues.length} violations found`);
        
        res.json({ 
          success: true,
          message: `Re-analysis completed. Found ${analysisResult.issues.length} violations.`,
          violationsFound: analysisResult.issues.length,
          reportId: creditReport.id 
        });
      } catch (error: any) {
        console.error("❌ Error in force re-analysis:", error);
        if (analysisRun) {
          await storage.updateAnalysisRunStatus(analysisRun.id, "failed");
        }
        await storage.updateCreditReportAnalysis(creditReport.id, null, "FAILED");
        res.status(500).json({ 
          success: false,
          message: `Re-analysis failed: ${error.message}` 
        });
      }
    } catch (error: any) {
      console.error("Error in force re-analyze:", error);
      res.status(500).json({ message: error.message || "Failed to re-analyze credit report" });
    }
  });

  // Diagnostic endpoint to test the analysis pipeline without saving to database
  app.post('/api/diagnostics/test-analysis', requireAuth, async (req: any, res) => {
    try {
      const results: any = {
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'unknown',
        steps: [],
        errors: []
      };

      // Step 1: Check environment
      results.aiConfig = {
        hasReplitAI: !!(process.env.AI_INTEGRATIONS_OPENAI_BASE_URL && process.env.AI_INTEGRATIONS_OPENAI_API_KEY),
        hasUserOpenAI: !!(process.env.OPENAI_API_KEY || process.env.OPENAI_KEY),
        model: process.env.OPENAI_MODEL || 'gpt-5'
      };
      results.steps.push({ step: 'environment_check', status: 'ok', details: results.aiConfig });

      // Step 2: Get user's credit reports
      const userId = req.session.userId;
      const reports = await storage.getCreditReportsByUserId(userId);
      results.reportCount = reports.length;
      results.steps.push({ 
        step: 'fetch_reports', 
        status: 'ok', 
        details: { count: reports.length, reports: reports.map(r => ({ id: r.id, status: r.analysisStatus, fileName: r.fileName })) }
      });

      if (reports.length === 0) {
        return res.json({ ...results, message: 'No credit reports found' });
      }

      // Step 3: Get violations count
      const violations = await storage.getViolationsByUserId(userId);
      results.violationCount = violations.length;
      results.steps.push({ step: 'fetch_violations', status: 'ok', details: { count: violations.length } });

      // Step 4: Test with first report if it has a local file
      const testReport = reports[0];
      if (testReport.fileUrl.startsWith('/files/')) {
        const localFileName = path.basename(testReport.fileUrl);
        const sanitizedFileName = localFileName.replace(/[^a-zA-Z0-9._-]/g, '_');
        const filesDir = process.env.FILES_DIR || "./files";
        const filePath = path.join(filesDir, sanitizedFileName);
        
        results.fileCheck = { 
          fileUrl: testReport.fileUrl, 
          localPath: filePath, 
          exists: fs.existsSync(filePath) 
        };
        results.steps.push({ step: 'file_check', status: results.fileCheck.exists ? 'ok' : 'error', details: results.fileCheck });

        if (results.fileCheck.exists) {
          try {
            // Step 5: Extract text
            const reportText = await ocrPdfOrImage(filePath);
            results.textExtraction = { 
              success: true, 
              textLength: reportText.length,
              sample: reportText.substring(0, 500) + '...'
            };
            results.steps.push({ step: 'text_extraction', status: 'ok', details: { textLength: reportText.length } });

            // Step 6: Test AI parsing
            try {
              const { parseCreditReportWithAiOnly } = await import('./services/creditReportParserV2');
              const triMergeReport = await parseCreditReportWithAiOnly({
                rawText: reportText,
                bureauHint: (testReport.bureau || 'TRI') as any,
                provider: 'IDENTITYIQ',
                userId: userId,
              });
              
              results.aiParsing = {
                success: true,
                tradelineCount: triMergeReport.tradelines?.length || 0,
                collectionCount: triMergeReport.collections?.length || 0,
              };
              results.steps.push({ step: 'ai_parsing', status: 'ok', details: results.aiParsing });

              // Step 7: Convert to legacy format
              const { convertTriMergeToLegacy } = await import('./services/convertTriMergeToLegacy');
              const parsedReport = convertTriMergeToLegacy(triMergeReport);
              
              results.legacyConversion = {
                bureauCount: parsedReport.bureaus.length,
                totalTradelines: parsedReport.bureaus.reduce((sum: number, b: any) => sum + b.tradelines.length, 0),
                totalCollections: parsedReport.bureaus.reduce((sum: number, b: any) => sum + b.collections.length, 0),
              };
              results.steps.push({ step: 'legacy_conversion', status: 'ok', details: results.legacyConversion });

              // Step 8: Run rules engine
              const analysisResult = await analyzeWithRulesEngine(parsedReport);
              results.rulesEngine = {
                issuesFound: analysisResult.issues.length,
                aiExplanationsCount: analysisResult.aiExplanations.length,
                issues: analysisResult.issues.map(i => ({
                  ruleId: i.ruleId,
                  category: i.category,
                  severity: i.severity,
                  bureaus: i.affectedBureaus
                }))
              };
              results.steps.push({ step: 'rules_engine', status: 'ok', details: results.rulesEngine });

            } catch (parseError: any) {
              results.steps.push({ step: 'ai_parsing', status: 'error', error: parseError.message });
              results.errors.push({ stage: 'ai_parsing', error: parseError.message, stack: parseError.stack });
            }
          } catch (extractError: any) {
            results.steps.push({ step: 'text_extraction', status: 'error', error: extractError.message });
            results.errors.push({ stage: 'text_extraction', error: extractError.message });
          }
        }
      } else {
        results.steps.push({ step: 'file_check', status: 'skipped', details: 'Remote file URL' });
      }

      results.success = results.errors.length === 0;
      res.json(results);
    } catch (error: any) {
      console.error("Diagnostic error:", error);
      res.status(500).json({ 
        success: false,
        error: error.message, 
        stack: error.stack 
      });
    }
  });

  // Helper function to safely resolve file paths within the uploads directory
  const safeResolvePath = (fileUrl: string): { valid: boolean; filePath?: string; error?: string } => {
    if (!fileUrl || typeof fileUrl !== 'string') {
      return { valid: false, error: "File URL is required" };
    }
    
    const filesDir = path.resolve(process.env.FILES_DIR || "./files");
    
    // Extract only the filename, stripping any path components
    const fileName = path.basename(fileUrl);
    
    // Reject if filename contains suspicious patterns
    if (fileName.includes('..') || fileName.includes('\0') || fileName.startsWith('.')) {
      return { valid: false, error: "Invalid file name" };
    }
    
    // Sanitize filename to only allow safe characters
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    
    // Build the full path and ensure it's within the allowed directory
    const filePath = path.resolve(filesDir, sanitizedFileName);
    
    // Verify the resolved path is within the files directory
    if (!filePath.startsWith(filesDir + path.sep) && filePath !== filesDir) {
      return { valid: false, error: "Invalid file path" };
    }
    
    return { valid: true, filePath };
  };

  // Metro 2 file parsing endpoint
  app.post('/api/credit-reports/parse-metro2', 
    rateLimit({ windowMs: 60_000, max: 5, namespace: 'metro2-parse' }),
    requireActiveSubscription,
    async (req: any, res) => {
      try {
        const { fileUrl, bureau } = req.body;
        
        const pathResult = safeResolvePath(fileUrl);
        if (!pathResult.valid || !pathResult.filePath) {
          return res.status(400).json({ message: pathResult.error || "Invalid file path" });
        }
        
        const filePath = pathResult.filePath;
        
        if (!fs.existsSync(filePath)) {
          return res.status(404).json({ message: "File not found" });
        }
        
        if (!isMetro2File(filePath)) {
          return res.status(400).json({ 
            message: "File is not a Metro 2 format. Expected .m2, .metro2, or .dat extension" 
          });
        }
        
        console.log(`📊 Parsing Metro 2 file: ${filePath}`);
        const parsedMetro2 = await parseMetro2File(filePath);
        
        console.log(`   Found ${parsedMetro2.baseSegments.length} base segments`);
        
        const creditReport = convertMetro2ToCreditReport(parsedMetro2, bureau || 'Other');
        
        console.log(`✅ Metro 2 parsing complete`);
        
        res.json({
          success: true,
          report: creditReport,
          metadata: {
            totalSegments: parsedMetro2.baseSegments.length,
            reporterName: parsedMetro2.header.reporterName,
            activityDate: parsedMetro2.header.activityDate,
          }
        });
      } catch (error: any) {
        console.error("Error parsing Metro 2 file:", error);
        res.status(500).json({ 
          message: error.message || "Failed to parse Metro 2 file",
          code: "METRO2_PARSE_ERROR"
        });
      }
    }
  );

  // Enhanced text extraction endpoint
  app.post('/api/credit-reports/extract-text',
    rateLimit({ windowMs: 60_000, max: 10, namespace: 'extract-text' }),
    requireActiveSubscription,
    async (req: any, res) => {
      try {
        const { fileUrl } = req.body;
        
        const pathResult = safeResolvePath(fileUrl);
        if (!pathResult.valid || !pathResult.filePath) {
          return res.status(400).json({ message: pathResult.error || "Invalid file path" });
        }
        
        const filePath = pathResult.filePath;
        
        if (!fs.existsSync(filePath)) {
          return res.status(404).json({ message: "File not found" });
        }
        
        console.log(`📄 Extracting text from: ${filePath}`);
        const extraction: ExtractionResult = await extractReportText(filePath);
        
        const format = detectReportFormat(extraction.text);
        const qualitySufficient = isTextQualitySufficient(extraction);
        
        console.log(`✅ Extraction complete: method=${extraction.method}, confidence=${extraction.confidence.toFixed(2)}, format=${format}`);
        
        res.json({
          success: true,
          text: extraction.text,
          method: extraction.method,
          confidence: extraction.confidence,
          pageCount: extraction.pageCount,
          detectedFormat: format,
          qualitySufficient,
        });
      } catch (error: any) {
        console.error("Error extracting text:", error);
        res.status(500).json({ 
          message: error.message || "Failed to extract text from file",
          code: "EXTRACTION_ERROR"
        });
      }
    }
  );

  // AI-powered dispute letter generation endpoint
  app.post('/api/dispute-letters/generate-ai',
    rateLimit({ windowMs: 60_000, max: 5, namespace: 'ai-letter' }),
    requireActiveSubscription,
    async (req: any, res) => {
      try {
        const userId = req.session.userId;
        const user = await storage.getUser(userId);
        
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }
        
        const generateSchema = z.object({
          bureau: z.enum(['EQUIFAX', 'TRANSUNION', 'EXPERIAN', 'Equifax', 'TransUnion', 'Experian']),
          issueIds: z.array(z.string()).min(1, "At least one issue must be selected"),
          round: z.number().int().min(1).max(3).optional().default(1),
        });
        
        const validatedData = generateSchema.parse(req.body);
        const { bureau, issueIds, round } = validatedData;
        
        // Get all credit reports for this user
        const creditReports = await storage.getCreditReportsByUserId(userId);
        
        // Get all issues and AI explanations from all analysis runs
        const allIssues: any[] = [];
        const allAiExplanations: any[] = [];
        
        for (const report of creditReports) {
          const runs = await storage.getAnalysisRunsByReportId(report.id);
          for (const run of runs) {
            const issues = await storage.getIssuesByRunId(run.id);
            const explanations = await storage.getAiIssueExplanationsByRunId(run.id);
            allIssues.push(...issues);
            allAiExplanations.push(...explanations);
          }
        }
        
        // Filter to selected issues
        const selectedIssues = allIssues.filter((issue: any) => issueIds.includes(issue.id));
        
        if (selectedIssues.length === 0) {
          return res.status(400).json({ message: "No valid issues selected" });
        }
        
        // Convert issues to violation summaries
        const violations = convertIssuesToViolationSummaries(selectedIssues as any);
        
        const consumerInfo = {
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Consumer',
          address: "123 Main Street",
          city: "Anytown",
          state: "FL",
          zip: "32801",
        };
        
        console.log(`🤖 Generating AI dispute letter for ${bureau}, round ${round}`);
        
        const letterContent = await draftAiDisputeLetter(
          violations,
          allAiExplanations as any,
          consumerInfo,
          bureau.toUpperCase() as any,
          round as 1 | 2 | 3
        );
        
        console.log(`✅ AI letter generation complete`);
        
        res.json({
          success: true,
          letterContent,
          bureau: bureau.toUpperCase(),
          round,
          violationCount: violations.length,
        });
      } catch (error: any) {
        console.error("Error generating AI dispute letter:", error);
        res.status(500).json({ 
          message: error.message || "Failed to generate dispute letter",
          code: "AI_LETTER_ERROR"
        });
      }
    }
  );

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
      
      // Validate input - now supports round and recipientType
      const generateLetterSchema = z.object({
        bureau: z.enum(['EQUIFAX', 'TRANSUNION', 'EXPERIAN']),
        violationIds: z.array(z.string()).min(1, "At least one violation must be selected"),
        round: z.number().int().min(1).max(3).optional().default(1),
        recipientType: z.enum(['BUREAU', 'COLLECTOR']).optional().default('BUREAU'),
        recipientName: z.string().optional(),
        priorDisputeDate: z.string().optional(),
        craResponseDate: z.string().optional(),
        reportDate: z.string().optional(),
      });
      
      const validatedData = generateLetterSchema.parse(req.body);
      const { bureau, violationIds, round, recipientType, recipientName, priorDisputeDate, craResponseDate, reportDate } = validatedData;

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get violations for letter generation
      const allViolations = await storage.getViolationsByUserId(userId);
      const selectedViolations = allViolations.filter(v => violationIds.includes(v.id));

      if (selectedViolations.length === 0) {
        return res.status(400).json({ message: "No violations selected" });
      }

      const userInfo = {
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Client',
        addressLine1: "123 Main Street",
        city: "Anytown",
        state: "FL",
        zip: "32801",
        phone: "(555) 123-4567",
        email: user.email,
        dob: "01/01/1990",
        ssnLast4: "1234"
      };

      const { generateRoundBasedLetter, getBureauAddress } = await import('./services/roundLetterTemplates');
      
      let letterContent: string;
      
      if (recipientType === 'BUREAU') {
        letterContent = generateRoundBasedLetter({
          round: round as 1 | 2 | 3,
          userInfo,
          bureauAddress: getBureauAddress(bureau),
          violations: selectedViolations.map(v => ({
            creditorName: v.accountName,
            accountNumber: v.accountNumber || undefined,
            issue: v.description,
            requestedAction: `Verify ${v.statute} compliance and correct or delete if unverifiable.`
          })),
          priorDisputeDate,
          craResponseDate,
          reportDate
        });
      } else {
        const { generateCollectorValidationLetter } = await import('./services/collectorLetterTemplates');
        
        letterContent = generateCollectorValidationLetter({
          userInfo,
          collectorInfo: {
            collectorName: recipientName || 'Collection Agency',
            addressLine1: '[Address to be filled]',
            city: '',
            state: '',
            zip: ''
          },
          debtInfo: {
            accountNumber: selectedViolations[0]?.accountNumber,
            originalCreditorName: selectedViolations[0]?.accountName,
            bureausReportedTo: [bureau]
          }
        });
      }

      let letterType = "INITIAL";
      if (round === 2) letterType = "FOLLOW_UP";
      if (round === 3) letterType = "CFPB";
      
      let pdfBuffer = Buffer.from("Sample PDF content");

      const disputeLetter = await storage.createDisputeLetter({
        userId,
        bureau,
        letterType,
        round,
        recipientType,
        recipientName: recipientName || undefined,
        content: letterContent,
        pdfUrl: `/api/dispute-letters/${bureau.toLowerCase()}-dispute-round${round}.pdf`,
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
              name: userInfo.name,
              address1: userInfo.addressLine1,
              city: userInfo.city,
              state: userInfo.state,
              zip: userInfo.zip
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

      // Check if PDF URL exists
      if (!letter.pdfUrl) {
        return res.status(404).json({ message: "PDF not available for this letter" });
      }

      // Read the PDF file from disk
      const pdfPath = path.join(process.cwd(), letter.pdfUrl);
      if (!fs.existsSync(pdfPath)) {
        return res.status(404).json({ message: "PDF file not found" });
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${letter.bureau}-dispute-letter.pdf"`);
      res.sendFile(pdfPath);
    } catch (error) {
      console.error("Error downloading dispute letter:", error);
      res.status(500).json({ message: "Failed to download dispute letter" });
    }
  });

  // AI Chat
  app.post('/api/chat', requireActiveSubscription, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const user = await storage.getUser(userId);
      const { message, conversationId } = req.body;

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if OpenAI API key is configured
      if (!process.env.OPENAI_API_KEY && !process.env.OPENAI_KEY && !process.env.OPEN_AI_KEY) {
        return res.status(503).json({ message: "AI chat service is not configured" });
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

      // Generate AI response using OpenAI
      const { chatWithAI } = await import("./services/openai");
      const aiResponse = await chatWithAI(
        message,
        conversationHistory,
        user.plan || "DIY",
        violations.map(v => ({
          ...v,
          accountNumber: v.accountNumber || undefined,
          severity: v.severity as "HIGH" | "MEDIUM" | "LOW"
        }))
      );

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

      // Check if OpenAI API key is configured
      if (!process.env.OPENAI_API_KEY && !process.env.OPENAI_KEY && !process.env.OPEN_AI_KEY) {
        return res.status(503).json({ message: "CFPB complaint generation service is not configured" });
      }

      // Generate CFPB complaint using OpenAI
      const { generateCFPBComplaint } = await import("./services/openai");
      const { complaintText, caseLawCitations } = await generateCFPBComplaint(
        violations.map(v => ({
          ...v,
          accountNumber: v.accountNumber || undefined,
          severity: v.severity as "HIGH" | "MEDIUM" | "LOW"
        })),
        clientInfo,
        disputeLetters
      );

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
