import {
  users,
  creditReports,
  violations,
  disputeLetters,
  disputeLetterViolations,
  chatConversations,
  notifications,
  cfpbComplaints,
  analysisRuns,
  issues,
  aiIssueExplanations,
  accountSummaries,
  type User,
  type UpsertUser,
  type InsertCreditReport,
  type CreditReport,
  type InsertViolation,
  type Violation,
  type InsertDisputeLetter,
  type DisputeLetter,
  type InsertChatConversation,
  type ChatConversation,
  type InsertNotification,
  type Notification,
  type InsertCfpbComplaint,
  type CfpbComplaint,
  type InsertAnalysisRun,
  type AnalysisRun,
  type InsertIssue,
  type Issue,
  type InsertAiIssueExplanation,
  type AiIssueExplanation,
  type InsertAccountSummary,
  type AccountSummary,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql } from "drizzle-orm";

export interface IStorage {
  // User operations - mandatory for Replit Auth
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserStripeInfo(userId: string, customerId: string, subscriptionId: string): Promise<User>;
  updateUserPlan(userId: string, plan: string): Promise<User>;
  updateUserProfile(userId: string, data: { firstName?: string; lastName?: string }): Promise<User>;
  
  // Credit Report operations
  createCreditReport(report: InsertCreditReport): Promise<CreditReport>;
  getCreditReportsByUserId(userId: string): Promise<CreditReport[]>;
  updateCreditReportAnalysis(id: string, analysisResults: any, status: string): Promise<CreditReport>;
  deleteCreditReport(id: string): Promise<void>;
  
  // Violations operations
  createViolation(violation: InsertViolation): Promise<Violation>;
  getViolationsByReportId(creditReportId: string): Promise<Violation[]>;
  getViolationsByUserId(userId: string): Promise<Violation[]>;
  deleteViolationsByReportId(creditReportId: string): Promise<void>;
  deleteAnalysisDataByReportId(creditReportId: string): Promise<void>;
  
  // Dispute Letters operations
  createDisputeLetter(letter: InsertDisputeLetter): Promise<DisputeLetter>;
  getDisputeLettersByUserId(userId: string): Promise<DisputeLetter[]>;
  updateDisputeLetterStatus(id: string, status: string, mailingId?: string): Promise<DisputeLetter>;
  
  // Chat operations
  createChatConversation(conversation: InsertChatConversation): Promise<ChatConversation>;
  getChatConversationsByUserId(userId: string): Promise<ChatConversation[]>;
  updateChatConversation(id: string, messages: any[]): Promise<ChatConversation>;
  
  // Notifications operations
  createNotification(notification: InsertNotification): Promise<Notification>;
  getNotificationsByUserId(userId: string): Promise<Notification[]>;
  
  // CFPB operations
  createCfpbComplaint(complaint: InsertCfpbComplaint): Promise<CfpbComplaint>;
  getCfpbComplaintsByUserId(userId: string): Promise<CfpbComplaint[]>;
  
  // Admin operations
  getAllUsers(): Promise<User[]>;
  getUserStats(): Promise<{
    totalUsers: number;
    proSubscribers: number;
    monthlyRevenue: number;
    lettersSent: number;
  }>;
  
  // Advanced Analysis operations
  createAnalysisRun(run: InsertAnalysisRun): Promise<AnalysisRun>;
  getAnalysisRunsByReportId(creditReportId: string): Promise<AnalysisRun[]>;
  updateAnalysisRunStatus(id: string, status: string, completedAt?: Date, issueCount?: number, aiIssueCount?: number): Promise<AnalysisRun>;
  
  createIssue(issue: InsertIssue): Promise<Issue>;
  getIssuesByRunId(runId: string): Promise<Issue[]>;
  
  createAiIssueExplanation(explanation: InsertAiIssueExplanation): Promise<AiIssueExplanation>;
  getAiIssueExplanationsByRunId(runId: string): Promise<AiIssueExplanation[]>;
  
  createAccountSummary(summary: InsertAccountSummary): Promise<AccountSummary>;
  getAccountSummariesByRunId(runId: string): Promise<AccountSummary[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const existingUser = await this.getUserByEmail(userData.email!);
    
    if (existingUser) {
      const updateData: any = {};
      Object.keys(userData).forEach(key => {
        if (userData[key as keyof UpsertUser] !== undefined) {
          updateData[key] = userData[key as keyof UpsertUser];
        }
      });
      updateData.updatedAt = new Date();
      
      const [user] = await db
        .update(users)
        .set(updateData)
        .where(eq(users.id, existingUser.id))
        .returning();
      return user;
    } else {
      const [user] = await db
        .insert(users)
        .values({
          ...userData,
          plan: userData.plan || 'DIY',
        })
        .returning();
      return user;
    }
  }

  async updateUserStripeInfo(userId: string, customerId: string, subscriptionId: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        plan: "DONE_FOR_YOU",
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async updateUserPlan(userId: string, plan: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        plan,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async updateUserProfile(userId: string, data: { firstName?: string; lastName?: string }): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  // Credit Report operations
  async createCreditReport(report: InsertCreditReport): Promise<CreditReport> {
    const [creditReport] = await db
      .insert(creditReports)
      .values(report)
      .returning();
    return creditReport;
  }

  async getCreditReportsByUserId(userId: string): Promise<CreditReport[]> {
    return await db
      .select()
      .from(creditReports)
      .where(eq(creditReports.userId, userId))
      .orderBy(desc(creditReports.createdAt));
  }

  async updateCreditReportAnalysis(id: string, analysisResults: any, status: string): Promise<CreditReport> {
    const [creditReport] = await db
      .update(creditReports)
      .set({
        analysisResults,
        analysisStatus: status,
      })
      .where(eq(creditReports.id, id))
      .returning();
    return creditReport;
  }

  async deleteCreditReport(id: string): Promise<void> {
    // Delete related records first
    await db.delete(violations).where(eq(violations.creditReportId, id));
    await db.delete(analysisRuns).where(eq(analysisRuns.creditReportId, id));
    await db.delete(issues).where(eq(issues.runId, sql`(SELECT id FROM analysis_runs WHERE credit_report_id = ${id})`));
    await db.delete(aiIssueExplanations).where(eq(aiIssueExplanations.runId, sql`(SELECT id FROM analysis_runs WHERE credit_report_id = ${id})`));
    // Delete the credit report itself
    await db.delete(creditReports).where(eq(creditReports.id, id));
  }

  // Violations operations
  async createViolation(violation: InsertViolation): Promise<Violation> {
    const [newViolation] = await db
      .insert(violations)
      .values(violation)
      .returning();
    return newViolation;
  }

  async getViolationsByReportId(creditReportId: string): Promise<Violation[]> {
    return await db
      .select()
      .from(violations)
      .where(eq(violations.creditReportId, creditReportId))
      .orderBy(desc(violations.createdAt));
  }

  async getViolationsByUserId(userId: string): Promise<Violation[]> {
    return await db
      .select({
        id: violations.id,
        creditReportId: violations.creditReportId,
        accountName: violations.accountName,
        accountNumber: violations.accountNumber,
        bureau: violations.bureau,
        violationType: violations.violationType,
        description: violations.description,
        statute: violations.statute,
        severity: violations.severity,
        status: violations.status,
        createdAt: violations.createdAt,
      })
      .from(violations)
      .innerJoin(creditReports, eq(violations.creditReportId, creditReports.id))
      .where(eq(creditReports.userId, userId))
      .orderBy(desc(violations.createdAt));
  }

  async deleteViolationsByReportId(creditReportId: string): Promise<void> {
    await db.delete(violations).where(eq(violations.creditReportId, creditReportId));
  }

  async deleteAnalysisDataByReportId(creditReportId: string): Promise<void> {
    const runs = await db.select().from(analysisRuns).where(eq(analysisRuns.creditReportId, creditReportId));
    for (const run of runs) {
      await db.delete(issues).where(eq(issues.runId, run.id));
      await db.delete(aiIssueExplanations).where(eq(aiIssueExplanations.runId, run.id));
    }
    await db.delete(analysisRuns).where(eq(analysisRuns.creditReportId, creditReportId));
  }

  // Dispute Letters operations
  async createDisputeLetter(letter: InsertDisputeLetter): Promise<DisputeLetter> {
    const [disputeLetter] = await db
      .insert(disputeLetters)
      .values(letter)
      .returning();
    return disputeLetter;
  }

  async getDisputeLettersByUserId(userId: string): Promise<DisputeLetter[]> {
    return await db
      .select()
      .from(disputeLetters)
      .where(eq(disputeLetters.userId, userId))
      .orderBy(desc(disputeLetters.createdAt));
  }

  async updateDisputeLetterStatus(id: string, status: string, mailingId?: string): Promise<DisputeLetter> {
    const updateData: any = { status };
    if (mailingId) {
      updateData.mailingId = mailingId;
    }
    if (status === "SENT") {
      updateData.sentAt = new Date();
      // Set response deadline to 30 days from sent date
      updateData.responseDeadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }

    const [disputeLetter] = await db
      .update(disputeLetters)
      .set(updateData)
      .where(eq(disputeLetters.id, id))
      .returning();
    return disputeLetter;
  }

  // Chat operations
  async createChatConversation(conversation: InsertChatConversation): Promise<ChatConversation> {
    const [chatConversation] = await db
      .insert(chatConversations)
      .values(conversation)
      .returning();
    return chatConversation;
  }

  async getChatConversationsByUserId(userId: string): Promise<ChatConversation[]> {
    return await db
      .select()
      .from(chatConversations)
      .where(eq(chatConversations.userId, userId))
      .orderBy(desc(chatConversations.updatedAt));
  }

  async updateChatConversation(id: string, messages: any[]): Promise<ChatConversation> {
    const [chatConversation] = await db
      .update(chatConversations)
      .set({
        messages,
        updatedAt: new Date(),
      })
      .where(eq(chatConversations.id, id))
      .returning();
    return chatConversation;
  }

  // Notifications operations
  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [newNotification] = await db
      .insert(notifications)
      .values(notification)
      .returning();
    return newNotification;
  }

  async getNotificationsByUserId(userId: string): Promise<Notification[]> {
    return await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt));
  }

  // CFPB operations
  async createCfpbComplaint(complaint: InsertCfpbComplaint): Promise<CfpbComplaint> {
    const [cfpbComplaint] = await db
      .insert(cfpbComplaints)
      .values(complaint)
      .returning();
    return cfpbComplaint;
  }

  async getCfpbComplaintsByUserId(userId: string): Promise<CfpbComplaint[]> {
    return await db
      .select()
      .from(cfpbComplaints)
      .where(eq(cfpbComplaints.userId, userId))
      .orderBy(desc(cfpbComplaints.createdAt));
  }

  // Admin operations
  async getAllUsers(): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .orderBy(desc(users.createdAt));
  }

  async getUserStats(): Promise<{
    totalUsers: number;
    proSubscribers: number;
    monthlyRevenue: number;
    lettersSent: number;
  }> {
    const allUsers = await this.getAllUsers();
    const totalUsers = allUsers.length;
    const diySubscribers = allUsers.filter(user => user.plan === "DIY").length;
    const proSubscribers = allUsers.filter(user => user.plan === "DONE_FOR_YOU").length;
    const monthlyRevenue = (diySubscribers * 19.95) + (proSubscribers * 149.99); // $19.95 per DIY + $149.99 per pro subscriber
    
    // Count sent letters
    const sentLetters = await db
      .select()
      .from(disputeLetters)
      .where(eq(disputeLetters.status, "SENT"));
    
    return {
      totalUsers,
      proSubscribers,
      monthlyRevenue,
      lettersSent: sentLetters.length,
    };
  }

  // Advanced Analysis operations
  async createAnalysisRun(run: InsertAnalysisRun): Promise<AnalysisRun> {
    const [analysisRun] = await db
      .insert(analysisRuns)
      .values(run)
      .returning();
    return analysisRun;
  }

  async getAnalysisRunsByReportId(creditReportId: string): Promise<AnalysisRun[]> {
    return await db
      .select()
      .from(analysisRuns)
      .where(eq(analysisRuns.creditReportId, creditReportId))
      .orderBy(desc(analysisRuns.startedAt));
  }

  async updateAnalysisRunStatus(
    id: string, 
    status: string, 
    completedAt?: Date, 
    issueCount?: number, 
    aiIssueCount?: number
  ): Promise<AnalysisRun> {
    const updateData: any = { status };
    if (completedAt) updateData.completedAt = completedAt;
    if (issueCount !== undefined) updateData.issueCount = issueCount;
    if (aiIssueCount !== undefined) updateData.aiIssueCount = aiIssueCount;

    const [analysisRun] = await db
      .update(analysisRuns)
      .set(updateData)
      .where(eq(analysisRuns.id, id))
      .returning();
    return analysisRun;
  }

  async createIssue(issue: InsertIssue): Promise<Issue> {
    const [newIssue] = await db
      .insert(issues)
      .values(issue)
      .returning();
    return newIssue;
  }

  async getIssuesByRunId(runId: string): Promise<Issue[]> {
    return await db
      .select()
      .from(issues)
      .where(eq(issues.runId, runId))
      .orderBy(desc(issues.createdAt));
  }

  async createAiIssueExplanation(explanation: InsertAiIssueExplanation): Promise<AiIssueExplanation> {
    const [newExplanation] = await db
      .insert(aiIssueExplanations)
      .values(explanation)
      .returning();
    return newExplanation;
  }

  async getAiIssueExplanationsByRunId(runId: string): Promise<AiIssueExplanation[]> {
    return await db
      .select()
      .from(aiIssueExplanations)
      .where(eq(aiIssueExplanations.runId, runId))
      .orderBy(desc(aiIssueExplanations.createdAt));
  }

  async createAccountSummary(summary: InsertAccountSummary): Promise<AccountSummary> {
    const [newSummary] = await db
      .insert(accountSummaries)
      .values(summary)
      .returning();
    return newSummary;
  }

  async getAccountSummariesByRunId(runId: string): Promise<AccountSummary[]> {
    return await db
      .select()
      .from(accountSummaries)
      .where(eq(accountSummaries.runId, runId))
      .orderBy(desc(accountSummaries.createdAt));
  }
}

export const storage = new DatabaseStorage();
