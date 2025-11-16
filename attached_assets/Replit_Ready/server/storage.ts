import {
  users,
  creditReports,
  violations,
  disputeLetters,
  disputeLetterViolations,
  chatConversations,
  notifications,
  cfpbComplaints,
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
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";

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
  
  // Violations operations
  createViolation(violation: InsertViolation): Promise<Violation>;
  getViolationsByReportId(creditReportId: string): Promise<Violation[]>;
  getViolationsByUserId(userId: string): Promise<Violation[]>;
  
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
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
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
}

export const storage = new DatabaseStorage();
