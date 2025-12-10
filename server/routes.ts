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
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { ObjectPermission } from "./objectAcl";

// Build version - update this when deploying to track which version is live
const BUILD_VERSION = "2025-12-04-v20-bucket-agnostic";
const BUILD_TIMESTAMP = new Date().toISOString();

export async function registerRoutes(app: Express, existingServer?: Server): Promise<Server> {
  // Use existing server if provided, otherwise create new one
  const httpServer = existingServer || createServer(app);
  // Serve objects from Object Storage (requires auth to check ownership)
  app.get("/objects/:objectPath(*)", requireAuth, async (req: any, res) => {
    const objectStorage = new ObjectStorageService();
    try {
      const userId = req.session?.userId;
      
      // Normalize the path to prevent traversal and double slashes
      const rawPath = req.path.replace(/\/+/g, '/');
      
      // Reject directory traversal attempts
      if (rawPath.includes('..') || rawPath.includes('%2e%2e') || rawPath.includes('%252e')) {
        return res.status(400).json({ error: "Invalid path" });
      }
      
      const objectFile = await objectStorage.getObjectEntityFile(rawPath);
      
      // Check if user can access this object
      const canAccess = await objectStorage.canAccessObjectEntity({
        userId,
        objectFile,
        requestedPermission: ObjectPermission.READ,
      });
      
      if (!canAccess) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      // Force safe content-disposition to prevent XSS
      const fileName = path.basename(rawPath);
      res.setHeader('Content-Disposition', `attachment; filename="${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}"`);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      
      objectStorage.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error serving object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: "File not found" });
      }
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Endpoint to get upload URL for Object Storage
  app.post("/api/objects/upload", requireAuth, async (req, res) => {
    try {
      const objectStorage = new ObjectStorageService();
      const uploadURL = await objectStorage.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error: any) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Version endpoint to verify deployment
  app.get('/api/version', (req, res) => {
    res.json({
      version: BUILD_VERSION,
      buildTime: BUILD_TIMESTAMP,
      environment: process.env.NODE_ENV || 'unknown',
      features: ['force-reanalyze', 'diagnostic-endpoint', 'v2-parser', 'cleanup-orphaned'],
      openaiConfigured: !!process.env.AI_INTEGRATIONS_OPENAI_API_KEY || !!process.env.OPENAI_API_KEY,
      usingReplitAI: !!(process.env.AI_INTEGRATIONS_OPENAI_BASE_URL && process.env.AI_INTEGRATIONS_OPENAI_API_KEY),
      model: (process.env.AI_INTEGRATIONS_OPENAI_BASE_URL && process.env.AI_INTEGRATIONS_OPENAI_API_KEY) ? 'gpt-4o' : (process.env.OPENAI_MODEL || 'gpt-4o')
    });
  });
  
  // Diagnostic endpoint to test AI parsing
  app.get('/api/diagnostic/openai-test', async (req, res) => {
    try {
      const OpenAI = (await import("openai")).default;
      const useReplitAI = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL && process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
      const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
      const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
      const model = useReplitAI ? "gpt-4o" : (process.env.OPENAI_MODEL || "gpt-4o");
      
      if (!apiKey) {
        return res.json({ 
          success: false, 
          error: 'No OpenAI API key configured',
          envVars: {
            hasIntegrationKey: !!process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
            hasStandardKey: !!process.env.OPENAI_API_KEY,
            hasBaseURL: !!baseURL
          }
        });
      }
      
      const openai = new OpenAI({ apiKey, baseURL });
      const testResponse = await openai.chat.completions.create({
        model,
        messages: [{ role: 'user', content: 'Say "OK" if you can read this.' }],
        max_completion_tokens: 10
      });
      
      res.json({ 
        success: true, 
        response: testResponse.choices[0].message.content,
        model,
        usingReplitAI: !!useReplitAI
      });
    } catch (error: any) {
      res.json({ 
        success: false, 
        error: error.message,
        code: error.code
      });
    }
  });

  // Diagnostic endpoint to test AI credit report parsing
  app.get('/api/diagnostic/test-parsing', async (req, res) => {
    try {
      const { parseCreditReportWithAiOnly } = await import('./services/creditReportParserV2');
      
      // Sample credit report text to test parsing
      const sampleText = `
EXPERIAN CREDIT REPORT
Report Date: 12/01/2025

ACCOUNT INFORMATION

Account Name: CAPITAL ONE
Account Number: ****1234
Account Type: Credit Card
Status: Open
Balance: $1,500
Credit Limit: $5,000
Date Opened: 01/15/2020
Last Payment: 11/15/2025

Account Name: CHASE BANK
Account Number: ****5678
Account Type: Credit Card
Status: Closed
Balance: $0
Credit Limit: $10,000
Date Opened: 06/20/2018
Date Closed: 05/01/2024

COLLECTION ACCOUNTS

Collection Agency: MIDLAND FUNDING
Original Creditor: SYNCHRONY BANK
Account Number: ****9999
Balance: $2,500
Status: Collection
Date Opened: 03/15/2023
`;

      console.log(`🧪 [DIAGNOSTIC] Testing AI parsing with sample text (${sampleText.length} chars)...`);
      
      const result = await parseCreditReportWithAiOnly({
        rawText: sampleText,
        bureauHint: 'EXPERIAN',
        provider: 'TEST',
        userId: 'diagnostic-test',
      });
      
      res.json({ 
        success: true, 
        tradelines: result.tradelines.length,
        collections: result.collections.length,
        sampleTradeline: result.tradelines[0] || null,
        sampleCollection: result.collections[0] || null,
        bureausIncluded: result.meta.bureausIncluded
      });
    } catch (error: any) {
      console.error(`❌ [DIAGNOSTIC] Parsing test failed:`, error.message);
      res.json({ 
        success: false, 
        error: error.message,
        stack: error.stack?.substring(0, 500)
      });
    }
  });

  // Import rules engine for test endpoint
  const { runAllRules } = await import('./rules/engine');
  
  // Test endpoint: Verify rules engine with actual credit report data
  app.get('/api/diagnostic/test-rules-engine', async (req, res) => {
    try {
      // Create test credit report based on actual Jarred Starman report from 11/24/2025
      const testReport: any = {
        pulledAt: '2025-11-24',
        provider: 'IdentityIQ',
        consumer: {
          fullName: 'JARRED COMSTOCK STARMAN',
          dob: '1978-05-29',
          addresses: [
            { line1: '175 S DESOTO BV', city: 'NAPLES', state: 'FL', postalCode: '34117' },
            { line1: '520 CROSSFIELD CIR', city: 'NAPLES', state: 'FL', postalCode: '34104-4725' }
          ]
        },
        bureaus: [
          // TransUnion Bureau
          {
            bureau: 'TransUnion' as const,
            tradelines: [
              // CROSSCOUNTRY Mortgage #1 - Late 120 Days with impossible payment jump
              {
                internalId: 'TU-CROSSCOUNTRY-1',
                creditorName: 'CROSSCOUNTRY',
                accountNumberMasked: '71797****',
                type: 'Mortgage' as const,
                status: 'Late120' as const,
                openedDate: '2022-03-11',
                balance: 85487,
                highCreditLimit: 85530,
                creditLimit: 0,
                pastDueAmount: 0,
                lastUpdatedDate: '2025-09-30',
                lastPaymentDate: '2025-09-09',
                paymentHistory: [
                  { month: '2025-09', status: '120' as const },
                  { month: '2025-08', status: '120' as const },
                  { month: '2025-07', status: '120' as const },
                  { month: '2025-06', status: '120' as const },
                  { month: '2025-05', status: '120' as const },
                  { month: '2025-04', status: '120' as const },
                  { month: '2025-03', status: '120' as const },
                  { month: '2024-11', status: '90' as const },
                  { month: '2024-10', status: '60' as const },
                  { month: '2024-09', status: 'OK' as const },
                  { month: '2024-08', status: 'OK' as const },
                  { month: '2024-07', status: 'OK' as const },
                ]
              },
              // CROSSCOUNTRY Mortgage #2 - Disputed, Late 120 Days
              {
                internalId: 'TU-CROSSCOUNTRY-2',
                creditorName: 'CROSSCOUNTRY',
                accountNumberMasked: '71797****-2',
                type: 'Mortgage' as const,
                status: 'Late120' as const,
                openedDate: '2021-12-28',
                balance: 388819,
                highCreditLimit: 370405,
                creditLimit: 0,
                pastDueAmount: 43532,
                lastUpdatedDate: '2025-09-30',
                lastPaymentDate: '2024-05-21',
                dateOfFirstDelinquency: '2024-06-01',
                paymentHistory: [
                  { month: '2025-09', status: '120' as const },
                  { month: '2025-08', status: '120' as const },
                  { month: '2025-07', status: '120' as const },
                  { month: '2025-06', status: '120' as const },
                  { month: '2024-11', status: '90' as const },
                  { month: '2024-10', status: '60' as const },
                  { month: '2024-09', status: 'OK' as const },
                ],
                metro2: {
                  specialCommentCode: 'XB' // Disputed
                }
              },
              // ACHIEVEPL - Derogatory installment loan
              {
                internalId: 'TU-ACHIEVEPL',
                creditorName: 'ACHIEVEPL',
                accountNumberMasked: 'APP1146****',
                type: 'PersonalLoan' as const,
                status: 'Delinquent' as const,
                openedDate: '2021-12-02',
                balance: 36520,
                highCreditLimit: 40000,
                creditLimit: 0,
                pastDueAmount: 0,
                lastUpdatedDate: '2025-09-30',
                paymentHistory: [
                  { month: '2025-09', status: '120' as const },
                  { month: '2025-08', status: '120' as const },
                  { month: '2025-07', status: '120' as const },
                  { month: '2025-06', status: '120' as const },
                  { month: '2024-11', status: '90' as const },
                  { month: '2024-10', status: '60' as const },
                  { month: '2024-09', status: 'OK' as const },
                ]
              },
              // DISCOVERCARD - Good standing
              {
                internalId: 'TU-DISCOVER',
                creditorName: 'DISCOVERCARD',
                accountNumberMasked: '601149941680****',
                type: 'CreditCard' as const,
                status: 'Open' as const,
                openedDate: '1992-09-02',
                balance: 0,
                highCreditLimit: 7412,
                creditLimit: 26000,
                pastDueAmount: 0,
                lastUpdatedDate: '2019-05-07',
                paymentHistory: []
              }
            ],
            collections: [
              // ABSRES INV - Collection from Navy Federal
              {
                internalId: 'TU-ABSRES',
                collectorName: 'ABSRES INV',
                originalCreditorName: 'NAVY FEDERAL CREDIT UNION',
                accountNumberMasked: '4975V49****',
                balance: 3624,
                status: 'Open' as const,
                openedDate: '2025-09-16',
                lastUpdatedDate: '2025-11-20',
                metro2: {
                  accountStatusCode: '93' // Collection
                }
              },
              // HARVARD COLL - Collection from IL Dept Human Services
              {
                internalId: 'TU-HARVARD',
                collectorName: 'HARVARD COLL',
                originalCreditorName: 'IL DEPARTMENT OF HUMAN SERVICE',
                accountNumberMasked: '3107****',
                balance: 436,
                status: 'Open' as const,
                openedDate: '2025-08-01',
                lastUpdatedDate: '2025-11-10',
                metro2: {
                  accountStatusCode: '93'
                }
              },
              // LVNV FUNDING - Collection from Synchrony/CareCredit (DISPUTED)
              {
                internalId: 'TU-LVNV',
                collectorName: 'LVNV FUNDING',
                originalCreditorName: 'SYNCHRONY BANK CARECREDIT',
                accountNumberMasked: '601918365820****',
                balance: 1572,
                status: 'Disputed' as const,
                openedDate: '2024-06-25',
                lastUpdatedDate: '2025-10-07',
                metro2: {
                  specialCommentCode: 'XB' // Disputed
                }
              }
            ],
            publicRecords: [],
            inquiries: []
          },
          // Experian Bureau - Cross-bureau inconsistencies
          {
            bureau: 'Experian' as const,
            tradelines: [
              // CROSSCOUNTRY Mortgage #1 - Late 30 Days (differs from TU 120!)
              {
                internalId: 'EX-CROSSCOUNTRY-1',
                creditorName: 'CROSSCOUNTRY',
                accountNumberMasked: '71797****',
                type: 'Mortgage' as const,
                status: 'Late30' as const,
                openedDate: '2022-03-01',
                balance: 85487,
                highCreditLimit: 85530,
                creditLimit: 0,
                pastDueAmount: 686, // Different from TU!
                lastUpdatedDate: '2025-10-31',
                lastPaymentDate: '2025-09-09',
                paymentHistory: [
                  { month: '2025-10', status: '30' as const },
                  { month: '2025-09', status: 'OK' as const },
                  { month: '2025-08', status: '180' as const },
                  { month: '2025-07', status: '180' as const },
                  { month: '2025-06', status: '180' as const },
                ]
              },
              // CROSSCOUNTRY Mortgage #2 - Late 180 Days (differs from TU 120!)
              {
                internalId: 'EX-CROSSCOUNTRY-2',
                creditorName: 'CROSSCOUNTRY',
                accountNumberMasked: '71797****-2',
                type: 'Mortgage' as const,
                status: 'Late150Plus' as const, // 180 days - differs from TU
                openedDate: '2021-12-01',
                balance: 388819,
                highCreditLimit: 370405,
                creditLimit: 0,
                pastDueAmount: 46685, // Different from TU 43532!
                lastUpdatedDate: '2025-10-31',
                lastPaymentDate: '2024-05-21',
                dateOfFirstDelinquency: '2024-06-01',
                paymentHistory: [
                  { month: '2025-10', status: '150' as const },
                  { month: '2025-09', status: '150' as const },
                  { month: '2025-08', status: '150' as const },
                  { month: '2025-07', status: '150' as const },
                ]
              },
              // ACHIEVEPL
              {
                internalId: 'EX-ACHIEVEPL',
                creditorName: 'ACHIEVEPL',
                accountNumberMasked: 'APP1146****',
                type: 'PersonalLoan' as const,
                status: 'Delinquent' as const,
                openedDate: '2021-12-01',
                balance: 36520,
                highCreditLimit: 40000,
                creditLimit: 0,
                lastUpdatedDate: '2025-09-30'
              }
            ],
            collections: [
              // ABSOLUTE RESOLUTIONS I
              {
                internalId: 'EX-ABSOLUTE',
                collectorName: 'ABSOLUTE RESOLUTIONS I',
                accountNumberMasked: '4975V49****',
                balance: 3624,
                status: 'Open' as const,
                openedDate: '2025-09-01',
                lastUpdatedDate: '2025-11-20',
                dateOfFirstDelinquency: undefined, // Missing DOFD!
                metro2: {
                  accountStatusCode: '93'
                }
              },
              // HARVARD COLL
              {
                internalId: 'EX-HARVARD',
                collectorName: 'HARVARD COLL',
                originalCreditorName: 'IL DEPARTMENT OF HUMAN SERVICE',
                accountNumberMasked: '3107****',
                balance: 436,
                status: 'Open' as const,
                openedDate: '2025-08-01',
                lastUpdatedDate: '2025-11-10'
              }
            ],
            publicRecords: [],
            inquiries: []
          },
          // Equifax Bureau
          {
            bureau: 'Equifax' as const,
            tradelines: [
              // CROSSCOUNTRY Mortgage #1 - Late 120 Days (matches TU)
              {
                internalId: 'EQ-CROSSCOUNTRY-1',
                creditorName: 'CROSSCOUNTRY',
                accountNumberMasked: '71797****',
                type: 'Mortgage' as const,
                status: 'Late120' as const,
                openedDate: '2022-03-01',
                balance: 85487,
                highCreditLimit: 85530,
                creditLimit: 0,
                pastDueAmount: 0,
                lastUpdatedDate: '2025-09-01',
                lastPaymentDate: '2025-09-01',
                paymentHistory: [
                  { month: '2025-09', status: '120' as const },
                  { month: '2025-08', status: '120' as const },
                  { month: '2025-07', status: '120' as const },
                  { month: '2025-06', status: '120' as const },
                  { month: '2025-05', status: '120' as const },
                  { month: '2025-04', status: '120' as const },
                  { month: '2025-03', status: '120' as const },
                ]
              },
              // CROSSCOUNTRY Mortgage #2
              {
                internalId: 'EQ-CROSSCOUNTRY-2',
                creditorName: 'CROSSCOUNTRY',
                accountNumberMasked: '71797****-2',
                type: 'Mortgage' as const,
                status: 'Late120' as const,
                openedDate: '2021-12-01',
                balance: 388819,
                highCreditLimit: 370405,
                creditLimit: 0,
                pastDueAmount: 43532,
                lastUpdatedDate: '2025-09-01',
                lastPaymentDate: '2024-07-01',
                dateOfFirstDelinquency: '2024-06-01',
                paymentHistory: [
                  { month: '2025-09', status: '120' as const },
                  { month: '2025-08', status: '120' as const },
                  { month: '2025-07', status: '120' as const },
                  { month: '2024-07', status: '60' as const },
                  { month: '2024-06', status: 'OK' as const },
                ]
              },
              // ACHIEVEPL
              {
                internalId: 'EQ-ACHIEVEPL',
                creditorName: 'ACHIEVEPL',
                accountNumberMasked: 'APP1146****',
                type: 'PersonalLoan' as const,
                status: 'Delinquent' as const,
                openedDate: '2021-12-01',
                balance: 36520,
                highCreditLimit: 36520, // Different from TU/EX!
                creditLimit: 0,
                lastUpdatedDate: '2025-09-01'
              }
            ],
            collections: [
              // ABSOLUTE RESOLUTIONS I
              {
                internalId: 'EQ-ABSOLUTE',
                collectorName: 'ABSOLUTE RESOLUTIONS I',
                accountNumberMasked: '4975V49****',
                balance: 3624,
                status: 'Open' as const,
                openedDate: '2025-09-01',
                lastUpdatedDate: '2025-11-01',
                dateOfFirstDelinquency: '2022-12-01'
              },
              // HARVARD COLL
              {
                internalId: 'EQ-HARVARD',
                collectorName: 'HARVARD COLL',
                originalCreditorName: 'IL DEPARTMENT OF HUMAN SERVICE',
                accountNumberMasked: '3107****',
                balance: 436,
                status: 'Open' as const,
                openedDate: '2025-08-01',
                lastUpdatedDate: '2025-11-01'
              }
            ],
            publicRecords: [],
            inquiries: []
          }
        ]
      };

      // Run the full rules engine
      const issues = runAllRules(testReport);
      
      // Group issues by category for better readability
      const issuesByCategory: Record<string, any[]> = {};
      for (const issue of issues) {
        const cat = issue.category || 'Uncategorized';
        if (!issuesByCategory[cat]) {
          issuesByCategory[cat] = [];
        }
        issuesByCategory[cat].push({
          ruleId: issue.ruleId,
          family: issue.family,
          severity: issue.severity,
          description: issue.descriptionMachine,
          bureaus: issue.affectedBureaus,
          statutes: issue.statutes
        });
      }
      
      // Count by family
      const byFamily: Record<string, number> = {};
      for (const issue of issues) {
        byFamily[issue.family] = (byFamily[issue.family] || 0) + 1;
      }
      
      // Count by severity
      const bySeverity: Record<string, number> = {};
      for (const issue of issues) {
        bySeverity[issue.severity] = (bySeverity[issue.severity] || 0) + 1;
      }
      
      res.json({
        success: true,
        version: BUILD_VERSION,
        testData: {
          bureaus: testReport.bureaus.length,
          tradelines: testReport.bureaus.reduce((sum: number, b: any) => sum + b.tradelines.length, 0),
          collections: testReport.bureaus.reduce((sum: number, b: any) => sum + b.collections.length, 0)
        },
        results: {
          totalIssues: issues.length,
          byFamily,
          bySeverity,
          categories: Object.keys(issuesByCategory).length
        },
        issuesByCategory
      });
      
    } catch (error: any) {
      console.error('Rules engine test error:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        stack: error.stack
      });
    }
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
      fileSize: 100 * 1024 * 1024, // 100MB limit
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

        const objectStorage = new ObjectStorageService();
        const fileBuffer = fs.readFileSync(req.file.path);
        const userId = req.session?.userId || "anonymous";
        const objectPath = await objectStorage.uploadBuffer(
          fileBuffer, 
          req.file.originalname, 
          req.file.mimetype,
          userId
        );
        
        fs.unlinkSync(req.file.path);
        console.log(`📤 [upload-file] Uploaded to Object Storage: ${objectPath}`);
        
        res.json({
          fileName: path.basename(objectPath),
          originalName: req.file.originalname,
          fileUrl: objectPath,
          fileSize: req.file.size,
          mimeType: req.file.mimetype
        });
      } catch (error: any) {
        console.error("File upload error:", error);
        if (req.file?.path && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ message: "File upload failed: " + error.message });
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
        
        const filesDir = process.env.FILES_DIR || "./files";
        let filePath: string;
        let tempFileCreated = false;
        
        // Handle different file URL types
        if (fileUrl.startsWith('/objects/')) {
          // Object Storage path - download to temp file
          console.log(`📦 Downloading from Object Storage: ${fileUrl}`);
          const objectStorage = new ObjectStorageService();
          try {
            const fileBuffer = await objectStorage.downloadToBuffer(fileUrl);
            const ext = path.extname(fileUrl) || '.pdf';
            const tempFileName = `${crypto.randomUUID()}${ext}`;
            
            if (!fs.existsSync(filesDir)) {
              fs.mkdirSync(filesDir, { recursive: true });
            }
            
            filePath = path.join(filesDir, tempFileName);
            fs.writeFileSync(filePath, fileBuffer, { mode: 0o600 });
            tempFileCreated = true;
            console.log(`✅ Downloaded from Object Storage to ${filePath}`);
          } catch (objError: any) {
            console.error(`❌ Object Storage download failed:`, objError.message);
            throw new Error(`Failed to download credit report from storage: ${objError.message}`);
          }
        } else if (fileUrl.startsWith('/files/')) {
          // Local file path
          const localFileName = path.basename(fileUrl);
          const sanitizedFileName = localFileName.replace(/[^a-zA-Z0-9._-]/g, '_');
          if (!sanitizedFileName || sanitizedFileName === '.' || sanitizedFileName === '..') {
            throw new Error('Invalid file name');
          }
          filePath = path.join(filesDir, sanitizedFileName);
          console.log(`📁 Using local file: ${filePath}`);
        } else {
          // Remote URL - download it
          let fileExt = '.pdf';
          try {
            const parsedUrl = new URL(fileUrl);
            const extFromPath = path.extname(parsedUrl.pathname).toLowerCase();
            if (['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(extFromPath)) {
              fileExt = extFromPath;
            }
          } catch (e) {
            console.warn('Failed to parse fileUrl for extension, using .pdf');
          }
          
          const downloadFileName = `${crypto.randomUUID()}${fileExt}`;
          filePath = path.join(filesDir, downloadFileName);
          
          console.log(`📥 Downloading file from ${fileUrl}...`);
          
          let parsedUrl;
          try {
            parsedUrl = new URL(fileUrl);
          } catch (e) {
            throw new Error('Invalid file URL');
          }
          
          if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
            throw new Error('Only HTTP/HTTPS URLs are allowed');
          }
          
          const hostname = parsedUrl.hostname.toLowerCase();
          const blockedHosts = ['localhost', '127.0.0.1', '[::1]'];
          const blockedPrefixes = ['192.168.', '10.', '169.254.'];
          for (let i = 16; i <= 31; i++) blockedPrefixes.push(`172.${i}.`);
          
          if (blockedHosts.includes(hostname) || blockedPrefixes.some(p => hostname.startsWith(p))) {
            throw new Error('Access to private networks is not allowed');
          }
          
          try {
            if (!fs.existsSync(filesDir)) {
              fs.mkdirSync(filesDir, { recursive: true });
            }
            
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 30000);
            
            const response = await fetch(fileUrl, { 
              signal: controller.signal,
              redirect: 'follow',
              headers: { 'User-Agent': 'PersonalCreditPros/1.0' }
            });
            clearTimeout(timeout);
            
            if (!response.ok) {
              throw new Error(`Failed to download file: ${response.statusText}`);
            }
            
            const contentLength = response.headers.get('content-length');
            if (contentLength && parseInt(contentLength) > 50 * 1024 * 1024) {
              throw new Error('File size exceeds 50MB limit');
            }
            
            const buffer = await response.arrayBuffer();
            fs.writeFileSync(filePath, Buffer.from(buffer), { mode: 0o600 });
            tempFileCreated = true;
            console.log(`✅ Downloaded file to ${filePath}`);
          } catch (downloadError: any) {
            console.error(`❌ Download failed:`, downloadError.message);
            throw new Error(`Failed to download credit report: ${downloadError.message}`);
          }
        }
        
        // Verify file exists
        if (!fs.existsSync(filePath)) {
          throw new Error(`Credit report file not found: ${filePath}`);
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
        } finally {
          // Clean up temp file if we created one
          if (tempFileCreated && fs.existsSync(filePath)) {
            try {
              fs.unlinkSync(filePath);
              console.log(`🧹 Cleaned up temp file: ${filePath}`);
            } catch (cleanupError) {
              console.warn(`Failed to cleanup temp file: ${filePath}`);
            }
          }
        }
        
        // Parse the text into a structured CreditReport object using AI (tri-merge capable)
        let parsedReport;
        try {
          console.log(`🤖 Parsing credit report with AI (tri-merge enabled)...`);
          console.log(`📄 Raw text length: ${reportText.length} characters`);
          console.log(`📄 Text sample (first 500 chars): ${reportText.slice(0, 500).replace(/\n/g, ' ')}`);
          
          const { parseCreditReportWithAiOnly } = await import('./services/creditReportParserV2');
          const triMergeReport = await parseCreditReportWithAiOnly({
            rawText: reportText,
            bureauHint: (bureau || 'TRI') as any,
            provider: 'IDENTITYIQ',
            userId: userId,
          });
          
          // CRITICAL: Log what the AI parser returned BEFORE conversion
          console.log(`📊 [AI PARSER OUTPUT] tradelines: ${triMergeReport.tradelines.length}, collections: ${triMergeReport.collections.length}`);
          console.log(`📊 [AI PARSER OUTPUT] bureausIncluded: ${triMergeReport.meta.bureausIncluded.join(', ')}`);
          
          // CRITICAL: Fail if AI returned no data
          if (triMergeReport.tradelines.length === 0 && triMergeReport.collections.length === 0) {
            console.error(`❌ AI parser returned ZERO tradelines and ZERO collections!`);
            throw new Error('AI parsing returned no credit data. The credit report may be unreadable or in an unsupported format.');
          }
          
          if (triMergeReport.tradelines.length > 0) {
            const sample = triMergeReport.tradelines[0];
            console.log(`📊 [AI PARSER OUTPUT] Sample tradeline: ${sample.creditorName}, bureaus: ${JSON.stringify(sample.bureaus)}, snapshots: ${sample.bureauSnapshots?.length || 0}`);
          }
          if (triMergeReport.collections.length > 0) {
            const sample = triMergeReport.collections[0];
            console.log(`📊 [AI PARSER OUTPUT] Sample collection: ${sample.collectorName}, bureaus: ${JSON.stringify(sample.bureaus)}, snapshots: ${sample.bureauSnapshots?.length || 0}`);
          }
          
          // Convert tri-merge format to legacy format for compatibility
          const { convertTriMergeToLegacy } = await import('./services/convertTriMergeToLegacy');
          parsedReport = convertTriMergeToLegacy(triMergeReport);
          
          // Log parsing results AFTER conversion
          const bureauCount = parsedReport.bureaus.length;
          const tradelineCount = parsedReport.bureaus.reduce((sum, b) => sum + b.tradelines.length, 0);
          const collectionCount = parsedReport.bureaus.reduce((sum, b) => sum + b.collections.length, 0);
          console.log(`✅ Successfully parsed and converted credit report:`);
          console.log(`   📊 After conversion: Bureaus: ${bureauCount}, Tradelines: ${tradelineCount}, Collections: ${collectionCount}`);
          
          // CRITICAL: Warn if AI returned data but conversion produced nothing
          if ((triMergeReport.tradelines.length > 0 || triMergeReport.collections.length > 0) && 
              (tradelineCount === 0 && collectionCount === 0)) {
            console.error(`❌ CRITICAL: AI parser returned data but conversion produced ZERO accounts!`);
            console.error(`   This indicates a bug in convertTriMergeToLegacy`);
          }
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
        // For multi-bureau violations, create a violation record for each affected bureau
        
        // Valid bureau names
        const VALID_BUREAUS = ['EQUIFAX', 'TRANSUNION', 'EXPERIAN'];
        
        // Helper to convert abbreviations/aliases to standard bureau names
        const mapToStandardBureau = (val: string): string | null => {
          const upper = val.toUpperCase().trim();
          if (VALID_BUREAUS.includes(upper)) return upper;
          // Handle common abbreviations and aliases
          if (['EQ', 'EQX', 'EQUI', 'EFX'].includes(upper)) return 'EQUIFAX';
          if (['TU', 'TUC', 'TRANS', 'TRU'].includes(upper)) return 'TRANSUNION';
          if (['EX', 'EXP', 'EXPER', 'XPN'].includes(upper)) return 'EXPERIAN';
          return null;
        };
        
        // Helper to normalize a single bureau value (string or deeply nested object) to valid bureau name
        const normalizeBureauValue = (val: any, depth: number = 0): string | null => {
          // Prevent infinite recursion
          if (depth > 10 || val === undefined || val === null) return null;
          
          // Handle strings directly
          if (typeof val === 'string') {
            return mapToStandardBureau(val);
          }
          
          // Handle arrays - collect all unique bureaus
          if (Array.isArray(val)) {
            for (const item of val) {
              const result = normalizeBureauValue(item, depth + 1);
              if (result) return result;
            }
            return null;
          }
          
          // Handle objects - try all common property names for bureau
          if (typeof val === 'object') {
            // Comprehensive list of all possible property names that might contain bureau info
            const propertyNames = [
              'bureau', 'bureauName', 'bureauAbbreviation', 'bureauCode', 'bureauAbbrev',
              'name', 'code', 'abbreviation', 'reportingBureau', 'abbrev',
              // Try to extract any string values from the object
            ];
            
            for (const prop of propertyNames) {
              if (val[prop] !== undefined) {
                const result = normalizeBureauValue(val[prop], depth + 1);
                if (result) return result;
              }
            }
            
            // As a last resort, check all string values in the object
            for (const key of Object.keys(val)) {
              const v = val[key];
              if (typeof v === 'string') {
                const result = mapToStandardBureau(v);
                if (result) return result;
              }
            }
            return null;
          }
          
          return null;
        };
        
        // True deep traversal to find ALL bureau values in any nested structure
        const deepFindBureaus = (obj: any, found: Set<string>, depth: number = 0): void => {
          if (depth > 15 || !obj) return;
          
          if (typeof obj === 'string') {
            const normalized = mapToStandardBureau(obj);
            if (normalized) found.add(normalized);
            return;
          }
          
          if (Array.isArray(obj)) {
            for (const item of obj) {
              deepFindBureaus(item, found, depth + 1);
            }
            return;
          }
          
          if (typeof obj === 'object') {
            for (const key of Object.keys(obj)) {
              deepFindBureaus(obj[key], found, depth + 1);
            }
          }
        };
        
        // Helper to extract bureaus from issue with robust fallback chain
        const extractBureausFromIssue = (issue: any, fallbackBureau: string): string[] => {
          const candidates: string[] = [];
          
          // 1. Primary: affectedBureaus array
          if (issue.affectedBureaus && Array.isArray(issue.affectedBureaus)) {
            for (const b of issue.affectedBureaus) {
              const normalized = normalizeBureauValue(b);
              if (normalized) candidates.push(normalized);
            }
          }
          if (candidates.length > 0) return Array.from(new Set(candidates));
          
          const details = issue.details || {};
          
          // 2. Fallback: details.bureau (single bureau)
          if (details.bureau) {
            const normalized = normalizeBureauValue(details.bureau);
            if (normalized) return [normalized];
          }
          
          // 3. Fallback: details.accountBureaus (array - may contain strings or objects)
          if (details.accountBureaus && Array.isArray(details.accountBureaus)) {
            for (const b of details.accountBureaus) {
              const normalized = normalizeBureauValue(b);
              if (normalized) candidates.push(normalized);
            }
          }
          if (candidates.length > 0) return Array.from(new Set(candidates));
          
          // 4. Fallback: extract from details.bureauSnapshots (array of objects)
          if (details.bureauSnapshots && Array.isArray(details.bureauSnapshots)) {
            for (const bs of details.bureauSnapshots) {
              const normalized = normalizeBureauValue(bs);
              if (normalized) candidates.push(normalized);
            }
          }
          if (candidates.length > 0) return Array.from(new Set(candidates));
          
          // 5. True deep traversal of entire issue object
          const deepFound = new Set<string>();
          deepFindBureaus(issue, deepFound);
          if (deepFound.size > 0) return Array.from(deepFound);
          
          // 6. Final fallback: report-level bureau only if it's a valid single-bureau report
          const fallbackNormalized = normalizeBureauValue(fallbackBureau);
          if (fallbackNormalized) {
            return [fallbackNormalized];
          }
          
          // Return empty array - caller should skip this violation
          return [];
        };
        
        const expandedViolations: any[] = [];
        let skippedIssues = 0;
        for (const issue of analysisResult.issues) {
          const bureaus = extractBureausFromIssue(issue, bureau || "");
          
          // Skip issues that couldn't be attributed to any bureau
          if (bureaus.length === 0) {
            console.warn(`⚠️  Skipping issue "${issue.category}" - no valid bureau could be determined`);
            skippedIssues++;
            continue;
          }
          
          for (const issueBureau of bureaus) {
            // Already normalized by extractBureausFromIssue
            expandedViolations.push({
              accountName: (issue.details as any)?.accountName || (issue.details as any)?.creditorName || (issue.details as any)?.collectorName || "Account",
              accountNumber: issue.affectedIds[0] || "N/A",
              bureau: issueBureau,
              violationType: issue.category,
              description: issue.descriptionMachine,
              statute: issue.statutes.join(", "),
              severity: issue.severity,
            });
          }
        }
        
        if (skippedIssues > 0) {
          console.warn(`⚠️  Skipped ${skippedIssues} issues due to missing bureau attribution`);
        }
        
        const legacyAnalysis = {
          violations: expandedViolations,
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

  // Clean up orphaned credit reports (files that no longer exist)
  // This uses FileAssetResolver to check all file types (local, Object Storage, remote URLs)
  app.post('/api/credit-reports/cleanup-orphaned', requireActiveSubscription, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const creditReports = await storage.getCreditReportsByUserId(userId);
      const { fileAssetResolver, FileAssetType } = await import('./fileAssetResolver');
      
      let deletedCount = 0;
      const deletedReports: string[] = [];
      const checkedReports: any[] = [];
      
      for (const report of creditReports) {
        try {
          const assetInfo = await fileAssetResolver.getAssetInfo(report.fileUrl);
          checkedReports.push({
            id: report.id,
            fileName: report.fileName,
            fileUrl: report.fileUrl,
            type: assetInfo.type,
            normalizedUrl: assetInfo.normalizedUrl,
            exists: assetInfo.exists
          });
          
          // Only delete if we can confirm the file doesn't exist
          // For remote URLs that we can't check, skip deletion
          if (!assetInfo.exists && assetInfo.type !== FileAssetType.REMOTE_URL && assetInfo.type !== FileAssetType.UNKNOWN) {
            console.log(`🗑️  Deleting orphaned report: ${report.fileName} (file missing: ${assetInfo.normalizedUrl})`);
            await storage.deleteCreditReport(report.id);
            deletedReports.push(report.fileName);
            deletedCount++;
          }
        } catch (checkError: any) {
          console.error(`⚠️  Error checking file for report ${report.id}: ${checkError.message}`);
          // Don't delete if we couldn't check - safer to keep the record
        }
      }
      
      console.log(`📋 Cleanup check: ${checkedReports.length} reports checked, ${deletedCount} deleted`);
      
      res.json({ 
        success: true,
        message: deletedCount > 0 
          ? `Cleaned up ${deletedCount} orphaned report(s)` 
          : "No orphaned reports found",
        deletedCount,
        deletedReports,
        checkedReports
      });
    } catch (error: any) {
      console.error("Error cleaning up orphaned reports:", error);
      res.status(500).json({ message: "Failed to clean up orphaned reports: " + error.message });
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
      
      // Delete the file using FileAssetResolver (handles both local and Object Storage)
      const { fileAssetResolver } = await import('./fileAssetResolver');
      try {
        await fileAssetResolver.deleteAsset(creditReport.fileUrl);
      } catch (error) {
        console.error(`⚠️  Failed to delete file: ${creditReport.fileUrl}`, error);
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

  // Soft delete credit report (keeps data but marks as deleted)
  app.patch('/api/credit-reports/:id/soft-delete', requireActiveSubscription, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const reportId = req.params.id;
      
      // Get the credit report to verify ownership
      const report = await storage.getCreditReportById(reportId);
      
      if (!report || report.userId !== userId) {
        return res.status(404).json({ message: "Credit report not found" });
      }
      
      if (report.isDeleted) {
        return res.status(400).json({ message: "Report is already deleted" });
      }
      
      const updatedReport = await storage.softDeleteCreditReport(reportId);
      console.log(`🗑️  Soft deleted credit report ${reportId}`);
      
      res.json({ 
        message: "Credit report moved to trash",
        report: updatedReport 
      });
    } catch (error: any) {
      console.error("Error soft deleting credit report:", error);
      res.status(500).json({ message: "Failed to delete credit report" });
    }
  });

  // Restore soft deleted credit report
  app.patch('/api/credit-reports/:id/restore', requireActiveSubscription, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const reportId = req.params.id;
      
      // Get the credit report including deleted ones
      const report = await storage.getCreditReportById(reportId);
      
      if (!report || report.userId !== userId) {
        return res.status(404).json({ message: "Credit report not found" });
      }
      
      if (!report.isDeleted) {
        return res.status(400).json({ message: "Report is not deleted" });
      }
      
      const updatedReport = await storage.restoreCreditReport(reportId);
      console.log(`♻️  Restored credit report ${reportId}`);
      
      res.json({ 
        message: "Credit report restored",
        report: updatedReport 
      });
    } catch (error: any) {
      console.error("Error restoring credit report:", error);
      res.status(500).json({ message: "Failed to restore credit report" });
    }
  });

  // Toggle analysis retention for a credit report
  app.patch('/api/credit-reports/:id/retention', requireActiveSubscription, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const reportId = req.params.id;
      const { retainAnalysis } = req.body;
      
      if (typeof retainAnalysis !== 'boolean') {
        return res.status(400).json({ message: "retainAnalysis must be a boolean" });
      }
      
      // Get the credit report to verify ownership
      const report = await storage.getCreditReportById(reportId);
      
      if (!report || report.userId !== userId) {
        return res.status(404).json({ message: "Credit report not found" });
      }
      
      const updatedReport = await storage.updateCreditReportRetention(reportId, retainAnalysis);
      console.log(`📝 Updated retention for report ${reportId}: ${retainAnalysis}`);
      
      res.json({ 
        message: `Analysis will ${retainAnalysis ? 'be kept' : 'be cleared'} on next upload`,
        report: updatedReport 
      });
    } catch (error: any) {
      console.error("Error updating retention:", error);
      res.status(500).json({ message: "Failed to update retention setting" });
    }
  });

  // Clear last analysis for a user
  app.post('/api/credit-reports/clear-last-analysis', requireActiveSubscription, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      
      await storage.clearLastAnalysis(userId);
      console.log(`🧹 Cleared last analysis for user ${userId}`);
      
      res.json({ 
        message: "Last analysis cleared successfully" 
      });
    } catch (error: any) {
      console.error("Error clearing last analysis:", error);
      res.status(500).json({ message: "Failed to clear last analysis" });
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

          // Create legacy violation records - expand multi-bureau violations
          // Valid bureau names
          const VALID_BUREAUS = ['EQUIFAX', 'TRANSUNION', 'EXPERIAN'];
          
          // Helper to convert abbreviations/aliases to standard bureau names
          const mapToStandardBureau = (val: string): string | null => {
            const upper = val.toUpperCase().trim();
            if (VALID_BUREAUS.includes(upper)) return upper;
            if (['EQ', 'EQX', 'EQUI', 'EFX'].includes(upper)) return 'EQUIFAX';
            if (['TU', 'TUC', 'TRANS', 'TRU'].includes(upper)) return 'TRANSUNION';
            if (['EX', 'EXP', 'EXPER', 'XPN'].includes(upper)) return 'EXPERIAN';
            return null;
          };
          
          // Helper to normalize a single bureau value (string or deeply nested object) to valid bureau name
          const normalizeBureauValue = (val: any, depth: number = 0): string | null => {
            if (depth > 10 || val === undefined || val === null) return null;
            if (typeof val === 'string') return mapToStandardBureau(val);
            if (Array.isArray(val)) {
              for (const item of val) {
                const result = normalizeBureauValue(item, depth + 1);
                if (result) return result;
              }
              return null;
            }
            if (typeof val === 'object') {
              const propertyNames = ['bureau', 'bureauName', 'bureauAbbreviation', 'bureauCode', 'bureauAbbrev', 'name', 'code', 'abbreviation', 'reportingBureau', 'abbrev'];
              for (const prop of propertyNames) {
                if (val[prop] !== undefined) {
                  const result = normalizeBureauValue(val[prop], depth + 1);
                  if (result) return result;
                }
              }
              for (const key of Object.keys(val)) {
                const v = val[key];
                if (typeof v === 'string') {
                  const result = mapToStandardBureau(v);
                  if (result) return result;
                }
              }
              return null;
            }
            return null;
          };
          
          // True deep traversal to find ALL bureau values in any nested structure
          const deepFindBureaus = (obj: any, found: Set<string>, depth: number = 0): void => {
            if (depth > 15 || !obj) return;
            if (typeof obj === 'string') {
              const normalized = mapToStandardBureau(obj);
              if (normalized) found.add(normalized);
              return;
            }
            if (Array.isArray(obj)) {
              for (const item of obj) deepFindBureaus(item, found, depth + 1);
              return;
            }
            if (typeof obj === 'object') {
              for (const key of Object.keys(obj)) deepFindBureaus(obj[key], found, depth + 1);
            }
          };
          
          // Helper to extract bureaus from issue with robust fallback chain
          const extractBureausFromIssue = (issue: any, fallbackBureau: string): string[] => {
            const candidates: string[] = [];
            if (issue.affectedBureaus && Array.isArray(issue.affectedBureaus)) {
              for (const b of issue.affectedBureaus) {
                const normalized = normalizeBureauValue(b);
                if (normalized) candidates.push(normalized);
              }
            }
            if (candidates.length > 0) return Array.from(new Set(candidates));
            const details = issue.details || {};
            if (details.bureau) {
              const normalized = normalizeBureauValue(details.bureau);
              if (normalized) return [normalized];
            }
            if (details.accountBureaus && Array.isArray(details.accountBureaus)) {
              for (const b of details.accountBureaus) {
                const normalized = normalizeBureauValue(b);
                if (normalized) candidates.push(normalized);
              }
            }
            if (candidates.length > 0) return Array.from(new Set(candidates));
            if (details.bureauSnapshots && Array.isArray(details.bureauSnapshots)) {
              for (const bs of details.bureauSnapshots) {
                const normalized = normalizeBureauValue(bs);
                if (normalized) candidates.push(normalized);
              }
            }
            if (candidates.length > 0) return Array.from(new Set(candidates));
            // True deep traversal as last resort
            const deepFound = new Set<string>();
            deepFindBureaus(issue, deepFound);
            if (deepFound.size > 0) return Array.from(deepFound);
            // Final fallback: report-level bureau only
            const fallbackNormalized = normalizeBureauValue(fallbackBureau);
            if (fallbackNormalized) return [fallbackNormalized];
            return [];
          };
          
          const expandedViolations: any[] = [];
          let skippedIssues = 0;
          for (const issue of analysisResult.issues) {
            const bureaus = extractBureausFromIssue(issue, creditReport.bureau || "");
            
            if (bureaus.length === 0) {
              console.warn(`⚠️  Skipping issue "${issue.category}" - no valid bureau could be determined`);
              skippedIssues++;
              continue;
            }
            
            for (const issueBureau of bureaus) {
              expandedViolations.push({
                accountName: (issue.details as any)?.accountName || (issue.details as any)?.creditorName || (issue.details as any)?.collectorName || "Account",
                accountNumber: issue.affectedIds[0] || "N/A",
                bureau: issueBureau,
                violationType: issue.category,
                description: issue.descriptionMachine,
                statute: issue.statutes.join(", "),
                severity: issue.severity,
              });
            }
          }
          
          if (skippedIssues > 0) {
            console.warn(`⚠️  Skipped ${skippedIssues} issues due to missing bureau attribution`);
          }
          
          const legacyAnalysis = {
            violations: expandedViolations,
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

        // Use FileAssetResolver to handle both legacy files and Object Storage
        const { fileAssetResolver, FileAssetType } = await import('./fileAssetResolver');
        
        // Check if file exists
        const assetInfo = await fileAssetResolver.getAssetInfo(creditReport.fileUrl);
        console.log(`📁 File type: ${assetInfo.type}, exists: ${assetInfo.exists}`);
        
        if (!assetInfo.exists) {
          return res.status(500).json({ 
            success: false, 
            message: `Re-analysis failed: File not found: ${creditReport.fileUrl}. Please re-upload the credit report.` 
          });
        }
        
        // Download file to temp location for OCR
        const { tempPath, cleanup } = await fileAssetResolver.downloadToTempFile(creditReport.fileUrl);
        
        let reportText = "";
        try {
          // Extract text from PDF
          console.log(`🔍 Extracting text from ${tempPath}...`);
          reportText = await ocrPdfOrImage(tempPath);
          console.log(`✅ Extracted ${reportText.length} characters from credit report`);
          console.log(`📄 First 500 chars of extracted text: ${reportText.substring(0, 500)}...`);
        } finally {
          cleanup();
        }
        
        if (!reportText || reportText.length < 100) {
          console.error(`❌ Text extraction failed or returned too little content`);
          return res.status(500).json({ 
            success: false, 
            message: `Text extraction failed. Only got ${reportText?.length || 0} characters.` 
          });
        }
        
        // Parse with AI (use V2 parser with improved date extraction)
        console.log(`🤖 Parsing credit report with AI V2...`);
        console.log(`   Bureau hint: ${creditReport.bureau || 'TRI'}`);
        const { parseCreditReportWithAiOnly } = await import('./services/creditReportParserV2');
        const triMergeReport = await parseCreditReportWithAiOnly({
          rawText: reportText,
          bureauHint: (creditReport.bureau || 'TRI') as any,
          provider: 'IDENTITYIQ',
          userId: creditReport.userId,
        });
        
        console.log(`🧮 AI parse result - tradelines: ${triMergeReport?.tradelines?.length || 0}, collections: ${triMergeReport?.collections?.length || 0}`);
        console.log(`   Bureaus included: ${triMergeReport?.meta?.bureausIncluded?.join(', ') || 'none'}`);
        
        // CRITICAL: Fail if AI returned no data
        if ((!triMergeReport?.tradelines || triMergeReport.tradelines.length === 0) && 
            (!triMergeReport?.collections || triMergeReport.collections.length === 0)) {
          console.error(`❌ AI parser returned ZERO tradelines and ZERO collections!`);
          throw new Error('AI parsing returned no credit data. The credit report may be unreadable or in an unsupported format. Please try re-uploading.');
        }
        
        // Log sample data from AI parser
        if (triMergeReport?.tradelines?.length > 0) {
          for (const tl of triMergeReport.tradelines.slice(0, 3)) {
            console.log(`   📊 Tradeline: ${tl.creditorName} - Status: ${tl.status} - Bureaus: ${JSON.stringify(tl.bureaus)} - Snapshots: ${tl.bureauSnapshots?.length || 0}`);
            if (tl.bureauSnapshots?.length > 0) {
              console.log(`      Snapshot bureaus: ${tl.bureauSnapshots.map((s: any) => s.bureau).join(', ')}`);
            }
          }
        }
        if (triMergeReport?.collections?.length > 0) {
          for (const col of triMergeReport.collections.slice(0, 3)) {
            console.log(`   🚨 Collection: ${col.collectorName} - Status: ${col.status} - Bureaus: ${JSON.stringify(col.bureaus)} - Snapshots: ${col.bureauSnapshots?.length || 0}`);
            if (col.bureauSnapshots?.length > 0) {
              console.log(`      Snapshot bureaus: ${col.bureauSnapshots.map((s: any) => s.bureau).join(', ')}`);
            }
          }
        }
        
        // Convert to legacy format for rules engine
        const { convertTriMergeToLegacy } = await import('./services/convertTriMergeToLegacy');
        const parsedReport = convertTriMergeToLegacy(triMergeReport);
        
        const bureauCount = parsedReport.bureaus.length;
        const tradelineCount = parsedReport.bureaus.reduce((sum: number, b: any) => sum + b.tradelines.length, 0);
        const collectionCount = parsedReport.bureaus.reduce((sum: number, b: any) => sum + b.collections.length, 0);
        console.log(`✅ Legacy format: ${bureauCount} bureaus, ${tradelineCount} tradelines, ${collectionCount} collections`);
        
        // CRITICAL: Warn if AI returned data but conversion produced nothing
        if ((triMergeReport.tradelines.length > 0 || triMergeReport.collections.length > 0) && 
            (tradelineCount === 0 && collectionCount === 0)) {
          console.error(`❌ CRITICAL: AI parser returned data but conversion produced ZERO accounts!`);
          console.error(`   This indicates a bug in convertTriMergeToLegacy`);
        }
        
        // Run analysis
        console.log(`🔬 Running rules engine analysis...`);
        const analysisResult = await analyzeWithRulesEngine(parsedReport);
        console.log(`✅ Analysis complete: ${analysisResult.issues.length} issues detected`);
        
        // Log details of each issue found
        for (const issue of analysisResult.issues) {
          console.log(`   📌 Issue: ${issue.ruleId} - ${issue.category} (${issue.severity})`);
        }
        
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

        // Create legacy violation records - expand multi-bureau violations
        // Valid bureau names
        const VALID_BUREAUS = ['EQUIFAX', 'TRANSUNION', 'EXPERIAN'];
        
        // Helper to convert abbreviations/aliases to standard bureau names
        const mapToStandardBureau = (val: string): string | null => {
          const upper = val.toUpperCase().trim();
          if (VALID_BUREAUS.includes(upper)) return upper;
          if (['EQ', 'EQX', 'EQUI', 'EFX'].includes(upper)) return 'EQUIFAX';
          if (['TU', 'TUC', 'TRANS', 'TRU'].includes(upper)) return 'TRANSUNION';
          if (['EX', 'EXP', 'EXPER', 'XPN'].includes(upper)) return 'EXPERIAN';
          return null;
        };
        
        // Helper to normalize a single bureau value (string or deeply nested object) to valid bureau name
        const normalizeBureauValue = (val: any, depth: number = 0): string | null => {
          if (depth > 10 || val === undefined || val === null) return null;
          if (typeof val === 'string') return mapToStandardBureau(val);
          if (Array.isArray(val)) {
            for (const item of val) {
              const result = normalizeBureauValue(item, depth + 1);
              if (result) return result;
            }
            return null;
          }
          if (typeof val === 'object') {
            const propertyNames = ['bureau', 'bureauName', 'bureauAbbreviation', 'bureauCode', 'bureauAbbrev', 'name', 'code', 'abbreviation', 'reportingBureau', 'abbrev'];
            for (const prop of propertyNames) {
              if (val[prop] !== undefined) {
                const result = normalizeBureauValue(val[prop], depth + 1);
                if (result) return result;
              }
            }
            for (const key of Object.keys(val)) {
              const v = val[key];
              if (typeof v === 'string') {
                const result = mapToStandardBureau(v);
                if (result) return result;
              }
            }
            return null;
          }
          return null;
        };
        
        // True deep traversal to find ALL bureau values in any nested structure
        const deepFindBureaus = (obj: any, found: Set<string>, depth: number = 0): void => {
          if (depth > 15 || !obj) return;
          if (typeof obj === 'string') {
            const normalized = mapToStandardBureau(obj);
            if (normalized) found.add(normalized);
            return;
          }
          if (Array.isArray(obj)) {
            for (const item of obj) deepFindBureaus(item, found, depth + 1);
            return;
          }
          if (typeof obj === 'object') {
            for (const key of Object.keys(obj)) deepFindBureaus(obj[key], found, depth + 1);
          }
        };
        
        // Helper to extract bureaus from issue with robust fallback chain
        const extractBureausFromIssue = (issue: any, fallbackBureau: string): string[] => {
          const candidates: string[] = [];
          if (issue.affectedBureaus && Array.isArray(issue.affectedBureaus)) {
            for (const b of issue.affectedBureaus) {
              const normalized = normalizeBureauValue(b);
              if (normalized) candidates.push(normalized);
            }
          }
          if (candidates.length > 0) return Array.from(new Set(candidates));
          const details = issue.details || {};
          if (details.bureau) {
            const normalized = normalizeBureauValue(details.bureau);
            if (normalized) return [normalized];
          }
          if (details.accountBureaus && Array.isArray(details.accountBureaus)) {
            for (const b of details.accountBureaus) {
              const normalized = normalizeBureauValue(b);
              if (normalized) candidates.push(normalized);
            }
          }
          if (candidates.length > 0) return Array.from(new Set(candidates));
          if (details.bureauSnapshots && Array.isArray(details.bureauSnapshots)) {
            for (const bs of details.bureauSnapshots) {
              const normalized = normalizeBureauValue(bs);
              if (normalized) candidates.push(normalized);
            }
          }
          if (candidates.length > 0) return Array.from(new Set(candidates));
          // True deep traversal as last resort
          const deepFound = new Set<string>();
          deepFindBureaus(issue, deepFound);
          if (deepFound.size > 0) return Array.from(deepFound);
          // Final fallback: report-level bureau only
          const fallbackNormalized = normalizeBureauValue(fallbackBureau);
          if (fallbackNormalized) return [fallbackNormalized];
          return [];
        };
        
        const expandedViolations: any[] = [];
        let skippedIssues = 0;
        for (const issue of analysisResult.issues) {
          const bureaus = extractBureausFromIssue(issue, creditReport.bureau || "");
          
          if (bureaus.length === 0) {
            console.warn(`⚠️  Skipping issue "${issue.category}" - no valid bureau could be determined`);
            skippedIssues++;
            continue;
          }
          
          for (const issueBureau of bureaus) {
            expandedViolations.push({
              accountName: (issue.details as any)?.accountName || (issue.details as any)?.creditorName || (issue.details as any)?.collectorName || "Account",
              accountNumber: issue.affectedIds[0] || "N/A",
              bureau: issueBureau,
              violationType: issue.category,
              description: issue.descriptionMachine,
              statute: issue.statutes.join(", "),
              severity: issue.severity,
            });
          }
        }
        
        if (skippedIssues > 0) {
          console.warn(`⚠️  Skipped ${skippedIssues} issues due to missing bureau attribution`);
        }
        
        const legacyAnalysis = {
          violations: expandedViolations,
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
        
        console.log(`✅ Force re-analysis completed for ${creditReport.id}: ${expandedViolations.length} violations found`);
        
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

      // Step 4: Test with first report - use FileAssetResolver to handle all file types
      const testReport = reports[0];
      const { fileAssetResolver } = await import('./fileAssetResolver');
      
      const assetInfo = await fileAssetResolver.getAssetInfo(testReport.fileUrl);
      results.fileCheck = { 
        fileUrl: testReport.fileUrl, 
        type: assetInfo.type,
        normalizedUrl: assetInfo.normalizedUrl,
        exists: assetInfo.exists 
      };
      results.steps.push({ step: 'file_check', status: assetInfo.exists ? 'ok' : 'error', details: results.fileCheck });

      if (assetInfo.exists) {
        try {
          // Step 5: Download to temp file and extract text
          const { tempPath, cleanup } = await fileAssetResolver.downloadToTempFile(testReport.fileUrl);
          
          try {
            const reportText = await ocrPdfOrImage(tempPath);
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
                bureaus: triMergeReport.meta?.bureausIncluded || [],
                sampleTradelines: (triMergeReport.tradelines || []).slice(0, 3).map((tl: any) => ({
                  creditor: tl.creditorName,
                  status: tl.status,
                  balance: tl.balance
                }))
              };
              results.steps.push({ step: 'ai_parsing', status: 'ok', details: results.aiParsing });

              // Step 7: Convert to legacy format
              const { convertTriMergeToLegacy } = await import('./services/convertTriMergeToLegacy');
              const parsedReport = convertTriMergeToLegacy(triMergeReport);
              
              results.legacyConversion = {
                bureauCount: parsedReport.bureaus.length,
                totalTradelines: parsedReport.bureaus.reduce((sum: number, b: any) => sum + b.tradelines.length, 0),
                totalCollections: parsedReport.bureaus.reduce((sum: number, b: any) => sum + b.collections.length, 0),
                sampleTradelines: parsedReport.bureaus.flatMap((b: any) => b.tradelines.slice(0, 2).map((tl: any) => ({
                  creditor: tl.creditorName,
                  status: tl.status,
                  balance: tl.balance
                })))
              };
              results.steps.push({ step: 'legacy_conversion', status: 'ok', details: results.legacyConversion });

              // Step 8: Run rules engine
              const analysisResult = await analyzeWithRulesEngine(parsedReport);
              results.rulesEngine = {
                issuesFound: analysisResult.issues.length,
                aiExplanationsCount: analysisResult.aiExplanations.length,
                issues: analysisResult.issues.slice(0, 10).map(i => ({
                  ruleId: i.ruleId,
                  category: i.category,
                  severity: i.severity,
                  bureaus: i.affectedBureaus,
                  description: i.descriptionMachine?.substring(0, 100)
                }))
              };
              results.steps.push({ step: 'rules_engine', status: 'ok', details: results.rulesEngine });

            } catch (parseError: any) {
              results.steps.push({ step: 'ai_parsing', status: 'error', error: parseError.message });
              results.errors.push({ stage: 'ai_parsing', error: parseError.message, stack: parseError.stack });
            }
          } finally {
            cleanup(); // Always cleanup temp file
          }
        } catch (extractError: any) {
          results.steps.push({ step: 'text_extraction', status: 'error', error: extractError.message });
          results.errors.push({ stage: 'text_extraction', error: extractError.message });
        }
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

  // TEST ENDPOINT: Public letter generation test - NO AUTH REQUIRED
  // This endpoint bypasses auth to verify the letter generation pipeline works
  app.post('/api/test-letter-gen', async (req: any, res) => {
    console.log('🧪 [TEST] Letter generation test endpoint called');
    try {
      // Get the user by email (passed in body for testing)
      const { userEmail, bureau = 'EXPERIAN' } = req.body;
      
      if (!userEmail) {
        return res.status(400).json({ message: "userEmail required in body" });
      }
      
      // Find user by email
      const allUsers = await db.select().from(users).where(eq(users.email, userEmail));
      const user = allUsers[0];
      
      if (!user) {
        return res.status(404).json({ message: `User not found: ${userEmail}` });
      }
      
      console.log('🧪 [TEST] Found user:', user.id);
      
      // Get violations for this user
      const allViolations = await storage.getViolationsByUserId(user.id);
      console.log('🧪 [TEST] Total violations:', allViolations.length);
      
      if (allViolations.length === 0) {
        return res.status(400).json({ 
          message: "No violations found for user",
          userId: user.id 
        });
      }
      
      // Filter to the specified bureau
      const bureauViolations = allViolations.filter(v => 
        v.bureau?.toUpperCase() === bureau.toUpperCase()
      );
      
      console.log('🧪 [TEST] Violations for bureau', bureau, ':', bureauViolations.length);
      
      if (bureauViolations.length === 0) {
        return res.status(400).json({ 
          message: `No violations found for bureau: ${bureau}`,
          availableBureaus: Array.from(new Set(allViolations.map(v => v.bureau)))
        });
      }
      
      // Take first violation
      const selectedViolation = bureauViolations[0];
      console.log('🧪 [TEST] Using violation:', selectedViolation.id);
      
      const userInfo = {
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Test User',
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
      
      const letterContent = generateRoundBasedLetter({
        round: 1,
        userInfo,
        bureauAddress: getBureauAddress(bureau.toUpperCase() as any),
        violations: [{
          creditorName: selectedViolation.accountName,
          accountNumber: selectedViolation.accountNumber || undefined,
          issue: selectedViolation.description,
          requestedAction: `Verify ${selectedViolation.statute} compliance and correct or delete if unverifiable.`
        }],
      });
      
      console.log('🧪 [TEST] Letter content generated, length:', letterContent.length);
      
      // Generate Word doc
      const { generateDisputeLetterDocx, saveDisputeLetterDocx } = await import('./services/wordDocGenerator');
      
      const docxBuffer = await generateDisputeLetterDocx({
        userInfo: {
          name: userInfo.name,
          addressLine1: userInfo.addressLine1,
          city: userInfo.city,
          state: userInfo.state,
          zip: userInfo.zip,
          email: userInfo.email
        },
        bureau: bureau.toUpperCase() as any,
        violations: [{
          accountName: selectedViolation.accountName,
          accountNumber: selectedViolation.accountNumber || undefined,
          description: selectedViolation.description,
          statute: selectedViolation.statute
        }],
        round: 1,
        letterContent
      });
      
      console.log('🧪 [TEST] Word doc generated, size:', docxBuffer.length);
      
      // Save to Object Storage
      const filename = `TEST_${bureau}_dispute_${Date.now()}.docx`;
      const docxUrl = await saveDisputeLetterDocx(docxBuffer, filename, user.id);
      console.log('🧪 [TEST] Saved to Object Storage:', docxUrl);
      
      // Save to database
      const disputeLetter = await storage.createDisputeLetter({
        userId: user.id,
        bureau: bureau.toUpperCase() as any,
        letterType: "INITIAL",
        round: 1,
        recipientType: "BUREAU",
        content: letterContent,
        pdfUrl: docxUrl,
        status: "GENERATED"
      });
      
      console.log('🧪 [TEST] Letter saved to database:', disputeLetter.id);
      
      res.json({
        success: true,
        message: "Test letter generated successfully",
        letterId: disputeLetter.id,
        docxUrl,
        violationUsed: selectedViolation.id,
        bureau: bureau.toUpperCase()
      });
    } catch (error: any) {
      console.error('🧪 [TEST] Error:', error);
      res.status(500).json({ 
        message: error.message,
        stack: error.stack
      });
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

  // Dispute Letters - Use requireAuth instead of requireActiveSubscription for simpler auth check
  app.post('/api/dispute-letters/generate', requireAuth, async (req: any, res) => {
    console.log('📨 [LETTER] Generate letter request received');
    // Only log non-sensitive metadata (not full request body for PII compliance)
    console.log('📨 [LETTER] Request params:', { 
      bureau: req.body?.bureau, 
      violationCount: req.body?.violationIds?.length || 0,
      round: req.body?.round,
      recipientType: req.body?.recipientType 
    });
    try {
      const userId = req.session.userId;
      console.log('📨 [LETTER] User ID:', userId ? 'present' : 'missing');
      const user = await storage.getUser(userId);
      console.log('📨 [LETTER] User found:', !!user);
      
      // Validate input - now supports round and recipientType
      // Accept both upper and mixed case bureau names
      const generateLetterSchema = z.object({
        bureau: z.enum(['EQUIFAX', 'TRANSUNION', 'EXPERIAN', 'Equifax', 'TransUnion', 'Experian']),
        violationIds: z.array(z.string()).min(1, "At least one violation must be selected"),
        round: z.number().int().min(1).max(3).optional().default(1),
        recipientType: z.enum(['BUREAU', 'COLLECTOR']).optional().default('BUREAU'),
        recipientName: z.string().optional(),
        priorDisputeDate: z.string().optional(),
        craResponseDate: z.string().optional(),
        reportDate: z.string().optional(),
      });
      
      const validatedData = generateLetterSchema.parse(req.body);
      // Normalize bureau to uppercase
      const bureau = validatedData.bureau.toUpperCase() as 'EQUIFAX' | 'TRANSUNION' | 'EXPERIAN';
      const { violationIds, round, recipientType, recipientName, priorDisputeDate, craResponseDate, reportDate } = validatedData;

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get violations for letter generation
      const allViolations = await storage.getViolationsByUserId(userId);
      console.log('📨 [LETTER] Total violations for user:', allViolations.length);
      console.log('📨 [LETTER] Violation IDs requested count:', violationIds?.length || 0);
      const selectedViolations = allViolations.filter(v => violationIds.includes(v.id));
      console.log('📨 [LETTER] Matching violations found:', selectedViolations.length);

      if (selectedViolations.length === 0) {
        console.log('📨 [LETTER] ERROR: No violations matched the requested IDs');
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

      console.log('📨 [LETTER] Generating Word document...');
      
      const { generateDisputeLetterDocx, saveDisputeLetterDocx } = await import('./services/wordDocGenerator');
      
      const docxBuffer = await generateDisputeLetterDocx({
        userInfo: {
          name: userInfo.name,
          addressLine1: userInfo.addressLine1,
          city: userInfo.city,
          state: userInfo.state,
          zip: userInfo.zip,
          email: userInfo.email
        },
        bureau,
        violations: selectedViolations.map(v => ({
          accountName: v.accountName,
          accountNumber: v.accountNumber || undefined,
          description: v.description,
          statute: v.statute
        })),
        round: round as 1 | 2 | 3,
        letterContent
      });
      
      const filename = `${bureau}_dispute_round${round}_${Date.now()}.docx`;
      const docxUrl = await saveDisputeLetterDocx(docxBuffer, filename, userId);
      console.log('📨 [LETTER] Word document saved:', docxUrl);

      console.log('📨 [LETTER] Creating dispute letter in database...');
      console.log('📨 [LETTER] Letter data:', { userId, bureau, letterType, round, recipientType });
      
      let disputeLetter;
      try {
        disputeLetter = await storage.createDisputeLetter({
          userId,
          bureau,
          letterType,
          round,
          recipientType,
          recipientName: recipientName || undefined,
          content: letterContent,
          pdfUrl: docxUrl,
          status: "GENERATED"
        });
        console.log('📨 [LETTER] Letter saved to database:', disputeLetter.id);
      } catch (dbError: any) {
        console.error('📨 [LETTER] Database error saving letter:', dbError.message);
        throw new Error(`Failed to save letter: ${dbError.message}`);
      }

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
            document: docxBuffer.toString('base64')
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

      console.log('📨 [LETTER] Letter created successfully:', disputeLetter.id);
      res.json(disputeLetter);
    } catch (error: any) {
      console.error("📨 [LETTER] Error generating dispute letter:", error);
      console.error("📨 [LETTER] Error stack:", error.stack);
      res.status(500).json({ message: error.message || "Failed to generate dispute letter" });
    }
  });

  app.get('/api/dispute-letters', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const letters = await storage.getDisputeLettersByUserId(userId);
      res.json(letters);
    } catch (error) {
      console.error("Error fetching dispute letters:", error);
      res.status(500).json({ message: "Failed to fetch dispute letters" });
    }
  });

  app.get('/api/dispute-letters/:id/download', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.session.userId;
      const letters = await storage.getDisputeLettersByUserId(userId);
      const letter = letters.find(l => l.id === id);

      if (!letter) {
        return res.status(404).json({ message: "Letter not found" });
      }

      const filename = `${letter.bureau}_Dispute_Letter_Round${letter.round}.docx`;
      
      // Try to get existing document from Object Storage
      let buffer: Buffer | null = null;
      
      if (letter.pdfUrl && letter.pdfUrl.startsWith('/objects/')) {
        try {
          const objectStorage = new ObjectStorageService();
          buffer = await objectStorage.downloadToBuffer(letter.pdfUrl);
        } catch (downloadError) {
          console.log('📥 Document not found in storage, will generate on-the-fly');
          buffer = null;
        }
      }
      
      // If no existing document, generate Word doc on-the-fly from letter content
      if (!buffer && letter.content) {
        console.log('📥 Generating Word doc on-the-fly for letter:', id);
        
        const user = await storage.getUser(userId);
        const { generateDisputeLetterDocx, saveDisputeLetterDocx } = await import('./services/wordDocGenerator');
        
        const userInfo = {
          name: `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Client',
          addressLine1: "123 Main Street",
          city: "Anytown",
          state: "FL",
          zip: "32801",
          email: user?.email || ''
        };
        
        buffer = await generateDisputeLetterDocx({
          userInfo,
          bureau: letter.bureau as 'EQUIFAX' | 'TRANSUNION' | 'EXPERIAN',
          violations: [],
          round: (letter.round || 1) as 1 | 2 | 3,
          letterContent: letter.content
        });
        
        // Save for future use
        try {
          const docxUrl = await saveDisputeLetterDocx(buffer, filename, userId);
          await storage.updateDisputeLetterStatus(letter.id, letter.status, undefined);
          // Update the pdfUrl in database
          const { db } = await import('./db');
          const { disputeLetters } = await import('@shared/schema');
          const { eq } = await import('drizzle-orm');
          await db.update(disputeLetters).set({ pdfUrl: docxUrl }).where(eq(disputeLetters.id, letter.id));
          console.log('📥 Saved generated doc to:', docxUrl);
        } catch (saveError) {
          console.error('📥 Failed to save doc, but will still return it:', saveError);
        }
      }
      
      if (!buffer) {
        return res.status(404).json({ message: "No document or content available for this letter" });
      }
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (error) {
      console.error("Error downloading dispute letter:", error);
      res.status(500).json({ message: "Failed to download dispute letter" });
    }
  });

  app.get('/api/dispute-letters/:id/view', requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const letters = await storage.getDisputeLettersByUserId(req.session.userId);
      const letter = letters.find(l => l.id === id);

      if (!letter) {
        return res.status(404).json({ message: "Letter not found" });
      }

      res.json({
        id: letter.id,
        bureau: letter.bureau,
        letterType: letter.letterType,
        round: letter.round,
        content: letter.content,
        status: letter.status,
        createdAt: letter.createdAt,
        hasDocument: !!letter.pdfUrl
      });
    } catch (error) {
      console.error("Error viewing dispute letter:", error);
      res.status(500).json({ message: "Failed to view dispute letter" });
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
      fileSize: 100 * 1024 * 1024, // 100MB limit
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

  return httpServer;
}
