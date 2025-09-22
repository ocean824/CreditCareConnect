import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  boolean,
  decimal,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table - required for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table - required for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  plan: varchar("plan").default("DIY").notNull(), // DIY, DONE_FOR_YOU, ENTERPRISE
  paypalCustomerId: varchar("paypal_customer_id"),
  paypalSubscriptionId: varchar("paypal_subscription_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Credit reports uploaded by users
export const creditReports = pgTable("credit_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  fileName: varchar("file_name").notNull(),
  fileUrl: varchar("file_url").notNull(),
  bureau: varchar("bureau"), // EQUIFAX, TRANSUNION, EXPERIAN
  analysisStatus: varchar("analysis_status").default("PENDING").notNull(), // PENDING, ANALYZING, COMPLETED, FAILED
  analysisResults: jsonb("analysis_results"), // JSON containing detected violations
  createdAt: timestamp("created_at").defaultNow(),
});

// Credit report violations detected by AI
export const violations = pgTable("violations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  creditReportId: varchar("credit_report_id").notNull().references(() => creditReports.id),
  accountName: varchar("account_name").notNull(),
  accountNumber: varchar("account_number"),
  bureau: varchar("bureau").notNull(),
  violationType: varchar("violation_type").notNull(),
  description: text("description").notNull(),
  statute: varchar("statute").notNull(), // FCRA section
  severity: varchar("severity").notNull(), // HIGH, MEDIUM, LOW
  status: varchar("status").default("IDENTIFIED").notNull(), // IDENTIFIED, DISPUTED, RESOLVED
  createdAt: timestamp("created_at").defaultNow(),
});

// Generated dispute letters
export const disputeLetters = pgTable("dispute_letters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  bureau: varchar("bureau").notNull(),
  letterType: varchar("letter_type").notNull(), // INITIAL, FOLLOW_UP, CFPB
  content: text("content").notNull(),
  pdfUrl: varchar("pdf_url"),
  status: varchar("status").default("DRAFT").notNull(), // DRAFT, GENERATED, SENT, RESPONDED
  sentAt: timestamp("sent_at"),
  responseDeadline: timestamp("response_deadline"),
  mailingId: varchar("mailing_id"), // Click2Mail tracking ID
  createdAt: timestamp("created_at").defaultNow(),
});

// Dispute letter violations relationship
export const disputeLetterViolations = pgTable("dispute_letter_violations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  disputeLetterId: varchar("dispute_letter_id").notNull().references(() => disputeLetters.id),
  violationId: varchar("violation_id").notNull().references(() => violations.id),
});

// AI chat conversations
export const chatConversations = pgTable("chat_conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  messages: jsonb("messages").notNull(), // Array of message objects
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Notifications sent to users
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: varchar("type").notNull(), // EMAIL, SMS
  subject: varchar("subject"),
  message: text("message").notNull(),
  status: varchar("status").default("PENDING").notNull(), // PENDING, SENT, FAILED
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// CFPB complaint packets
export const cfpbComplaints = pgTable("cfpb_complaints", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  complaintNumber: varchar("complaint_number"),
  content: text("content").notNull(),
  supporting_documents: jsonb("supporting_documents"), // Array of document URLs
  caseLawCitations: jsonb("case_law_citations"), // Array of relevant case law
  status: varchar("status").default("DRAFT").notNull(), // DRAFT, SUBMITTED
  submittedAt: timestamp("submitted_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Schema types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export const insertCreditReportSchema = createInsertSchema(creditReports).omit({
  id: true,
  createdAt: true,
});
export type InsertCreditReport = z.infer<typeof insertCreditReportSchema>;
export type CreditReport = typeof creditReports.$inferSelect;

export const insertViolationSchema = createInsertSchema(violations).omit({
  id: true,
  createdAt: true,
});
export type InsertViolation = z.infer<typeof insertViolationSchema>;
export type Violation = typeof violations.$inferSelect;

export const insertDisputeLetterSchema = createInsertSchema(disputeLetters).omit({
  id: true,
  createdAt: true,
});
export type InsertDisputeLetter = z.infer<typeof insertDisputeLetterSchema>;
export type DisputeLetter = typeof disputeLetters.$inferSelect;

export const insertChatConversationSchema = createInsertSchema(chatConversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertChatConversation = z.infer<typeof insertChatConversationSchema>;
export type ChatConversation = typeof chatConversations.$inferSelect;

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

export const insertCfpbComplaintSchema = createInsertSchema(cfpbComplaints).omit({
  id: true,
  createdAt: true,
});
export type InsertCfpbComplaint = z.infer<typeof insertCfpbComplaintSchema>;
export type CfpbComplaint = typeof cfpbComplaints.$inferSelect;
