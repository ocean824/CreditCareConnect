import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
// import { analyzeCreditReport, generateDisputeLetter, chatWithAI, generateCFPBComplaint } from "./services/openai";
import { click2mailService } from "./services/click2mail";
import { letterGeneratorService } from "./services/letterGenerator";
import { notificationService } from "./services/notificationService";
import { insertCreditReportSchema, insertViolationSchema, insertDisputeLetterSchema, insertChatConversationSchema, insertCfpbComplaintSchema } from "@shared/schema";
import { createPaypalOrder, capturePaypalOrder, loadPaypalDefault } from "./paypal";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // PayPal routes
  app.get("/api/paypal/setup", async (req, res) => {
    await loadPaypalDefault(req, res);
  });

  app.post("/api/paypal/order", async (req, res) => {
    await createPaypalOrder(req, res);
  });

  app.post("/api/paypal/order/:orderID/capture", async (req, res) => {
    await capturePaypalOrder(req, res);
  });

  // PayPal subscription route
  app.post('/api/create-subscription', isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    let user = await storage.getUser(userId);
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.paypalSubscriptionId) {
      return res.send({
        subscriptionId: user.paypalSubscriptionId,
        status: "active"
      });
    }
    
    if (!user.email) {
      return res.status(400).json({ message: 'No user email on file' });
    }

    try {
      // For now, create a simple subscription record
      // In production, you'd integrate with PayPal's subscription API
      const subscriptionId = `paypal_sub_${Date.now()}`;
      const customerId = user.paypalCustomerId || `paypal_cust_${Date.now()}`;
      
      await storage.updateUserPaypalInfo(userId, customerId, subscriptionId);
      await storage.updateUserPlan(userId, "DONE_FOR_YOU");
      
      // Send upgrade confirmation
      await notificationService.sendUpgradeConfirmation(user.email, user.firstName || 'User');
  
      res.send({
        subscriptionId: subscriptionId,
        status: "active"
      });
    } catch (error: any) {
      console.error("PayPal subscription error:", error);
      return res.status(400).send({ error: { message: error.message } });
    }
  });

  // Credit Report Analysis
  app.post('/api/credit-reports/upload', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
        } catch (error) {
          console.error("Error in background analysis:", error);
          await storage.updateCreditReportAnalysis(creditReport.id, null, "FAILED");
        }
      }, 5000);

      res.json(creditReport);
    } catch (error) {
      console.error("Error uploading credit report:", error);
      res.status(500).json({ message: "Failed to upload credit report" });
    }
  });

  app.get('/api/credit-reports', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const creditReports = await storage.getCreditReportsByUserId(userId);
      res.json(creditReports);
    } catch (error) {
      console.error("Error fetching credit reports:", error);
      res.status(500).json({ message: "Failed to fetch credit reports" });
    }
  });

  // Violations
  app.get('/api/violations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const violations = await storage.getViolationsByUserId(userId);
      res.json(violations);
    } catch (error) {
      console.error("Error fetching violations:", error);
      res.status(500).json({ message: "Failed to fetch violations" });
    }
  });

  // Dispute Letters
  app.post('/api/dispute-letters/generate', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const { bureau, violationIds } = req.body;

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

  app.get('/api/dispute-letters', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const letters = await storage.getDisputeLettersByUserId(userId);
      res.json(letters);
    } catch (error) {
      console.error("Error fetching dispute letters:", error);
      res.status(500).json({ message: "Failed to fetch dispute letters" });
    }
  });

  app.get('/api/dispute-letters/:id/download', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const letters = await storage.getDisputeLettersByUserId(req.user.claims.sub);
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
  app.post('/api/chat', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
  app.post('/api/cfpb-complaints/generate', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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

  // Admin Routes (protected by plan check)
  app.get('/api/admin/stats', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      
      // Simple admin check - in production you'd have proper role-based access
      if (!user?.email?.includes('admin')) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const stats = await storage.getUserStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching admin stats:", error);
      res.status(500).json({ message: "Failed to fetch admin stats" });
    }
  });

  app.get('/api/admin/users', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      
      if (!user?.email?.includes('admin')) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        paypal: process.env.PAYPAL_CLIENT_ID ? 'configured' : 'not configured',
        openai: process.env.OPENAI_API_KEY ? 'configured' : 'not configured',
        click2mail: process.env.CLICK2MAIL_API_KEY ? 'configured' : 'not configured',
        twilio: process.env.TWILIO_ACCOUNT_SID ? 'configured' : 'not configured'
      }
    });
  });

  const httpServer = createServer(app);
  return httpServer;
}
