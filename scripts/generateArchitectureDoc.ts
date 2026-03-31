import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  PageBreak,
  TableOfContents,
} from "docx";
import * as fs from "fs";
import * as path from "path";

function heading1(text: string): Paragraph {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 200 },
  });
}

function heading2(text: string): Paragraph {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 300, after: 150 },
  });
}

function heading3(text: string): Paragraph {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 100 },
  });
}

function para(text: string, bold?: boolean): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold })],
    spacing: { after: 120 },
  });
}

function bullet(text: string, level = 0): Paragraph {
  return new Paragraph({
    text,
    bullet: { level },
    spacing: { after: 80 },
  });
}

function tableRow(cells: string[], isHeader = false): TableRow {
  return new TableRow({
    tableHeader: isHeader,
    children: cells.map(
      (text) =>
        new TableCell({
          children: [
            new Paragraph({
              children: [new TextRun({ text, bold: isHeader })],
            }),
          ],
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1 },
            bottom: { style: BorderStyle.SINGLE, size: 1 },
            left: { style: BorderStyle.SINGLE, size: 1 },
            right: { style: BorderStyle.SINGLE, size: 1 },
          },
        })
    ),
  });
}

function makeTable(headers: string[], rows: string[][]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      tableRow(headers, true),
      ...rows.map((r) => tableRow(r)),
    ],
  });
}

function pageBreak(): Paragraph {
  return new Paragraph({ children: [new PageBreak()] });
}

export async function generateArchitectureDoc(outputPath: string): Promise<void> {
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 22 },
        },
      },
    },
    sections: [
      {
        children: [
          // ── COVER PAGE ──────────────────────────────────────────────────────────
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 2000, after: 400 },
            children: [
              new TextRun({
                text: "Credit Repair SaaS Platform",
                bold: true,
                size: 56,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: "Architecture & Product Requirements Document",
                size: 40,
                color: "444444",
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [new TextRun({ text: "Version 1.0  |  March 31, 2026", size: 28, color: "666666" })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [new TextRun({ text: "Confidential — Internal Use Only", size: 24, italics: true, color: "888888" })],
          }),
          pageBreak(),

          // ── TABLE OF CONTENTS (static) ────────────────────────────────────────
          heading1("Table of Contents"),
          para("1. Executive Summary"),
          para("2. Tech Stack"),
          para("3. System Architecture Blueprint"),
          para("4. Database Schema"),
          para("5. Frontend Pages & Components PRD"),
          para("6. Backend Routes PRD"),
          para("7. Services PRD"),
          para("8. AI Logic PRD"),
          para("9. Rules Engine PRD"),
          para("10. Payments & Subscription PRD"),
          para("11. Physical Mail PRD"),
          para("12. Admin Console PRD"),
          para("13. Security & Auth PRD"),
          para("14. Feature Roadmap / Key Features Summary"),
          pageBreak(),

          // ── 1. EXECUTIVE SUMMARY ─────────────────────────────────────────────
          heading1("1. Executive Summary"),
          para(
            "The Credit Repair SaaS Platform is a full-stack web application that empowers consumers " +
            "to identify, dispute, and resolve inaccuracies on their credit reports. The platform " +
            "combines an advanced AI-driven rules engine with automated dispute letter generation, " +
            "physical mail dispatch, and a comprehensive admin console — delivering a turnkey credit " +
            "repair workflow for both self-directed (DIY) users and managed (Done-For-You) clients."
          ),
          para(
            "Target users include individuals seeking to improve their credit scores, credit repair " +
            "professionals managing client portfolios, and enterprise partners integrating credit " +
            "repair services into their offerings."
          ),
          bullet("Consumers upload credit reports (PDF, TXT, or Metro 2 binary)."),
          bullet("A multi-pass rules engine detects FCRA, FDCPA, and Metro 2 violations."),
          bullet("OpenAI GPT-5 explains each violation in plain language and prioritizes disputes."),
          bullet("AI drafts legally-compliant dispute letters per bureau (Round 1 / 2 / 3)."),
          bullet("Letters are dispatched via Click2Mail (certified first-class USPS mail) automatically."),
          bullet("An admin console tracks users, cases, audit logs, and bulk operations."),
          bullet("Stripe handles subscription billing across DIY, Done-For-You, and Enterprise tiers."),
          pageBreak(),

          // ── 2. TECH STACK ─────────────────────────────────────────────────────
          heading1("2. Tech Stack"),
          makeTable(
            ["Layer", "Technology", "Notes"],
            [
              ["Frontend Framework", "React 18 + TypeScript", "Vite dev/build toolchain"],
              ["Styling", "Tailwind CSS + shadcn/ui", "Radix primitives, design system"],
              ["Routing", "Wouter", "Lightweight client-side router"],
              ["Data Fetching", "TanStack Query v5", "Query/mutation caching layer"],
              ["Backend Runtime", "Node.js + Express 5", "TypeScript compiled via tsx/esbuild"],
              ["Database", "PostgreSQL 16", "Hosted on Replit / Neon"],
              ["ORM", "Drizzle ORM + drizzle-zod", "Type-safe schema & validation"],
              ["Auth", "Passport.js (local strategy)", "Session stored in PostgreSQL sessions table"],
              ["AI", "OpenAI GPT-5 (gpt-5)", "Replit AI Integrations or direct OpenAI key"],
              ["Payments", "Stripe", "Subscriptions, webhooks, customer portal"],
              ["Object Storage", "Replit Object Storage", "ACL-protected private & public buckets"],
              ["Physical Mail", "Click2Mail REST API", "First-class USPS certified letters"],
              ["PDF OCR", "Tesseract / Ollama", "Fallback OCR for image-based PDFs"],
              ["Rate Limiting", "Custom middleware", "In-memory sliding-window per IP"],
            ]
          ),
          pageBreak(),

          // ── 3. SYSTEM ARCHITECTURE BLUEPRINT ─────────────────────────────────
          heading1("3. System Architecture Blueprint"),
          para("The application follows a layered architecture:"),
          heading2("3.1 Layers"),
          bullet("Client (Browser) — React SPA served by Vite; communicates with the API via fetch/TanStack Query."),
          bullet("API Layer (Express) — REST endpoints in server/routes.ts and server/adminRoutes.ts."),
          bullet("Service Layer — Stateless modules: creditReportParserV2, advancedCreditAnalysis, aiLetterDrafting, letterGenerator, click2mail, freezeAgent, notificationService."),
          bullet("Rules Engine — server/rules/engine.ts orchestrates 13 rule sets (balance, status, timeline, collection, identity, dispute, FCRA-enhanced, disputable, comprehensive-FCRA, comprehensive-FDCPA, Metro2, cross-bureau, expanded-FCRA)."),
          bullet("AI Layer — OpenAI GPT-5 called for: (a) parsing, (b) violation explanations, (c) dispute letter drafting."),
          bullet("Persistence — PostgreSQL via Drizzle ORM; Object Storage for binary uploads (PDFs/images)."),
          bullet("External APIs — Click2Mail (physical mail), Stripe (billing)."),
          heading2("3.2 Data Flow — Analysis Pipeline"),
          bullet("User uploads credit report → stored in Object Storage (.private/)."),
          bullet("Server extracts text (PDF text layer → OCR fallback) and detects format (PDF, TXT, Metro 2)."),
          bullet("Parser (creditReportParserV2) structures raw text into a normalized CreditReport model."),
          bullet("Rules engine runs all 13 rule sets and returns IssueFlag[]."),
          bullet("AI step 1: GPT-5 generates human-readable explanations and priorities for each IssueFlag."),
          bullet("AI step 2: GPT-5 drafts a bureau-specific dispute letter (Round 1/2/3)."),
          bullet("Results persisted in analysis_runs, issues, ai_issue_explanations tables."),
          bullet("Dispute letter persisted in dispute_letters; optionally dispatched via Click2Mail."),
          pageBreak(),

          // ── 4. DATABASE SCHEMA ────────────────────────────────────────────────
          heading1("4. Database Schema"),
          para("All tables are defined in shared/schema.ts using Drizzle ORM."),

          heading2("4.1 sessions"),
          para("Stores Express session data for both user and admin authentication."),
          makeTable(
            ["Column", "Type", "Purpose"],
            [
              ["sid", "varchar PK", "Session ID"],
              ["sess", "jsonb", "Serialized session payload"],
              ["expire", "timestamp", "Session expiry (indexed)"],
            ]
          ),

          heading2("4.2 users"),
          para("Core user accounts — both regular users and admins."),
          makeTable(
            ["Column", "Type", "Purpose"],
            [
              ["id", "varchar PK (UUID)", "Primary key"],
              ["email", "varchar UNIQUE", "Login email"],
              ["first_name / last_name", "varchar", "Display name"],
              ["profile_image_url", "varchar", "Avatar URL"],
              ["plan", "varchar", "DIY | DONE_FOR_YOU | ENTERPRISE"],
              ["role", "varchar(10)", "user | admin"],
              ["stripe_customer_id", "varchar", "Stripe customer reference"],
              ["stripe_subscription_id", "varchar", "Active subscription ID"],
              ["subscription_status", "varchar", "active | inactive | cancelled | past_due"],
              ["subscription_expires_at", "timestamp", "Subscription end date"],
              ["created_at / updated_at", "timestamp", "Audit timestamps"],
            ]
          ),

          heading2("4.3 user_credentials"),
          para("Password hashes for email/password authentication (separate from users to allow OAuth extension)."),
          makeTable(
            ["Column", "Type", "Purpose"],
            [
              ["id", "varchar PK", "Primary key"],
              ["user_id", "varchar FK → users", "Owner"],
              ["password_hash", "varchar", "bcrypt hash"],
              ["created_at / updated_at", "timestamp", "Audit timestamps"],
            ]
          ),

          heading2("4.4 admin_credentials"),
          para("Separate credential store for admin panel login."),
          makeTable(
            ["Column", "Type", "Purpose"],
            [
              ["id", "varchar PK", "Primary key"],
              ["username", "varchar UNIQUE", "Admin username"],
              ["password_hash", "varchar", "bcrypt hash"],
              ["email", "varchar", "Optional admin email"],
              ["created_at / updated_at", "timestamp", "Audit timestamps"],
            ]
          ),

          heading2("4.5 credit_reports"),
          para("Each uploaded credit report file with analysis state."),
          makeTable(
            ["Column", "Type", "Purpose"],
            [
              ["id", "varchar PK", "Primary key"],
              ["user_id", "varchar FK → users", "Owner"],
              ["file_name", "varchar", "Original filename"],
              ["file_url", "varchar", "Object Storage path"],
              ["bureau", "varchar", "EQUIFAX | TRANSUNION | EXPERIAN | TRI-MERGE"],
              ["analysis_status", "varchar", "PENDING | ANALYZING | COMPLETED | FAILED"],
              ["analysis_results", "jsonb", "Raw JSON of detected violations"],
              ["analysis_number", "integer", "Sequential per-user analysis counter"],
              ["retain_analysis", "boolean", "Whether to keep results"],
              ["is_deleted / deleted_at", "boolean / timestamp", "Soft-delete support"],
              ["created_at", "timestamp", "Upload timestamp"],
            ]
          ),

          heading2("4.6 violations"),
          para("Individual FCRA/FDCPA/Metro2 violations detected per report."),
          makeTable(
            ["Column", "Type", "Purpose"],
            [
              ["id", "varchar PK", "Primary key"],
              ["credit_report_id", "varchar FK → credit_reports", "Cascade delete"],
              ["account_name", "varchar", "Creditor / collector name"],
              ["account_number", "varchar", "Masked account number"],
              ["bureau", "varchar", "Bureau where violation appears"],
              ["violation_type", "varchar", "Rule category"],
              ["description", "text", "Human-readable description"],
              ["statute", "varchar", "FCRA section"],
              ["severity", "varchar", "HIGH | MEDIUM | LOW"],
              ["status", "varchar", "IDENTIFIED | DISPUTED | RESOLVED"],
              ["created_at", "timestamp", "Detection timestamp"],
            ]
          ),

          heading2("4.7 dispute_letters"),
          para("Generated dispute letters, one per bureau per round."),
          makeTable(
            ["Column", "Type", "Purpose"],
            [
              ["id", "varchar PK", "Primary key"],
              ["user_id", "varchar FK → users", "Owner"],
              ["bureau", "varchar", "Target bureau"],
              ["letter_type", "varchar", "INITIAL | FOLLOW_UP | CFPB"],
              ["round", "integer", "1 | 2 | 3"],
              ["recipient_type", "varchar", "BUREAU | COLLECTOR"],
              ["recipient_name", "varchar", "For collector letters"],
              ["content", "text", "Full letter text"],
              ["pdf_url", "varchar", "Object Storage path for PDF"],
              ["status", "varchar", "DRAFT | GENERATED | SENT | RESPONDED"],
              ["sent_at / response_deadline", "timestamp", "Mail tracking"],
              ["mailing_id", "varchar", "Click2Mail job ID"],
              ["created_at", "timestamp", "Generation timestamp"],
            ]
          ),

          heading2("4.8 analysis_runs"),
          para("Tracks each execution of the AI analysis pipeline."),
          makeTable(
            ["Column", "Type", "Purpose"],
            [
              ["id", "varchar PK", "Primary key"],
              ["credit_report_id", "varchar FK → credit_reports", "Source report"],
              ["engine_version", "varchar", "Rules engine version tag"],
              ["ai_model", "varchar", "OpenAI model used"],
              ["status", "varchar", "completed | failed"],
              ["started_at / completed_at", "timestamp", "Runtime tracking"],
              ["issue_count / ai_issue_count", "integer", "Result metrics"],
              ["notes", "text", "Optional debug notes"],
            ]
          ),

          heading2("4.9 issues"),
          para("Structured violation flags produced by the rules engine (one row per IssueFlag)."),
          makeTable(
            ["Column", "Type", "Purpose"],
            [
              ["id", "varchar PK", "Primary key"],
              ["run_id", "varchar FK → analysis_runs", "Parent run"],
              ["issue_id", "varchar", "Stable deterministic ID"],
              ["rule_id", "varchar", "Rule that fired (e.g. BAL-001)"],
              ["family / category", "varchar", "Rule family and category"],
              ["severity", "varchar", "HIGH | MEDIUM | LOW"],
              ["affected_entity_type", "varchar", "TRADELINE | COLLECTION | INQUIRY"],
              ["affected_bureaus", "text[]", "Bureaus where issue appears"],
              ["affected_ids", "jsonb", "Internal account IDs"],
              ["statutes", "text[]", "Applicable FCRA/FDCPA statutes"],
              ["description_machine", "text", "Machine-generated description"],
              ["explanation_key", "varchar", "Key for human explanation lookup"],
              ["details", "jsonb", "Raw rule-specific payload"],
              ["created_at", "timestamp", "Detection timestamp"],
            ]
          ),

          heading2("4.10 ai_issue_explanations"),
          para("GPT-5 explanations for each issue flag."),
          makeTable(
            ["Column", "Type", "Purpose"],
            [
              ["id", "varchar PK", "Primary key"],
              ["run_id", "varchar FK → analysis_runs", "Parent run"],
              ["issue_id", "varchar", "References issues.issue_id"],
              ["account_label", "varchar", "Readable account name"],
              ["human_summary", "text", "GPT-generated plain-English explanation"],
              ["statutes", "text[]", "Statutes cited by AI"],
              ["dispute_angle", "varchar", "INACCURATE | UNVERIFIABLE | OBSOLETE | MISLEADING"],
              ["recommended_action", "text", "GPT-generated action recommendation"],
              ["priority", "integer", "1 (highest) to 5 (lowest)"],
              ["raw_ai_payload", "jsonb", "Full API response for auditing"],
              ["created_at", "timestamp", "Generation timestamp"],
            ]
          ),

          heading2("4.11 mail_batches"),
          para("Tracks physical mail dispatch jobs per case/bureau/round."),
          makeTable(
            ["Column", "Type", "Purpose"],
            [
              ["id", "varchar PK", "Primary key"],
              ["client_id", "varchar FK → users", "Client"],
              ["case_id", "varchar", "Logical case grouping"],
              ["bureau", "varchar", "Target bureau"],
              ["round", "integer", "1 | 2 | 3"],
              ["click2mail_job_id", "varchar", "Click2Mail job reference"],
              ["usps_tracking", "varchar", "USPS tracking number"],
              ["proof_url", "text", "Pre-flight proof PDF URL"],
              ["status", "varchar", "queued | processing | mailed | failed"],
              ["created_at", "timestamp", "Dispatch timestamp"],
            ]
          ),

          heading2("4.12 delivery_events"),
          para("Webhook events from Click2Mail for delivery tracking."),
          makeTable(
            ["Column", "Type", "Purpose"],
            [
              ["id", "varchar PK", "Primary key"],
              ["batch_id", "varchar FK → mail_batches", "Parent batch"],
              ["kind", "varchar", "Event type (e.g. DELIVERED, RETURNED)"],
              ["payload", "jsonb", "Raw webhook payload"],
              ["created_at", "timestamp", "Event timestamp"],
            ]
          ),

          heading2("4.13 admin_audit_logs"),
          para("Immutable log of every admin action for compliance."),
          makeTable(
            ["Column", "Type", "Purpose"],
            [
              ["id", "varchar PK", "Primary key"],
              ["actor_id", "varchar FK → users", "Admin who performed the action"],
              ["action", "varchar", "Action name (e.g. update_user_role)"],
              ["target_type", "varchar", "Entity type (user, mail_batch, etc.)"],
              ["target_id", "varchar", "ID of affected entity"],
              ["meta", "jsonb", "Additional context"],
              ["created_at", "timestamp", "Action timestamp"],
            ]
          ),

          heading2("4.14 chat_conversations"),
          para("AI chat conversation history per user."),
          makeTable(
            ["Column", "Type", "Purpose"],
            [
              ["id", "varchar PK", "Primary key"],
              ["user_id", "varchar FK → users", "Owner"],
              ["messages", "jsonb", "Array of {role, content} message objects"],
              ["created_at / updated_at", "timestamp", "Timestamps"],
            ]
          ),

          pageBreak(),

          // ── 5. FRONTEND PAGES & COMPONENTS PRD ───────────────────────────────
          heading1("5. Frontend Pages & Components PRD"),

          heading2("5.1 Landing Page (/")  ,
          para("Purpose: Marketing and conversion page for unauthenticated users."),
          bullet("Displays platform value propositions, feature highlights, and pricing tiers."),
          bullet("Provides Login and Register CTAs."),
          bullet("Authenticated users with active subscriptions are redirected to /dashboard."),

          heading2("5.2 Dashboard (/dashboard)"),
          para("Purpose: Primary user workspace after login."),
          bullet("Displays credit report upload widget (CreditReportUploader component)."),
          bullet("Shows latest analysis results and violation summary cards."),
          bullet("Provides quick navigation to Letters, Analysis, and Reports pages."),
          bullet("Includes onboarding modal for new users (OnboardingModal component)."),

          heading2("5.3 Analysis (/analysis)"),
          para("Purpose: Detailed view of AI analysis results for a credit report."),
          bullet("Renders list of IssueFlag items with severity badges."),
          bullet("Shows AI-generated explanations and recommended actions per issue."),
          bullet("Allows filtering by bureau, severity, and category."),
          bullet("Provides 'Generate Dispute Letters' action."),

          heading2("5.4 Letters (/letters)"),
          para("Purpose: Manage and generate dispute letters."),
          bullet("Lists all generated dispute letters grouped by bureau and round."),
          bullet("Allows viewing full letter content and PDF preview (PrintPreviewModal)."),
          bullet("Provides controls to generate Round 1 / 2 / 3 letters per bureau."),
          bullet("Shows mailing status (DRAFT, SENT, RESPONDED)."),

          heading2("5.5 Credit Reports (/reports)"),
          para("Purpose: Library view of all uploaded credit reports."),
          bullet("Lists all reports with upload date, bureau, and analysis status."),
          bullet("Allows navigating to individual report detail pages."),
          bullet("Soft-deleted reports are hidden."),

          heading2("5.6 Report Detail (/reports/:reportId)"),
          para("Purpose: Per-report analysis view."),
          bullet("Shows parsed data from a specific report."),
          bullet("Displays associated analysis runs and detected issues."),

          heading2("5.7 Admin Overview (/admin)"),
          para("Purpose: High-level dashboard for administrators."),
          bullet("Shows aggregate statistics: total users, cases, letters, pending responses."),
          bullet("Navigation hub to all admin sub-pages."),
          bullet("Protected by adminOnly middleware."),

          heading2("5.8 Admin Users (/admin/users)"),
          para("Purpose: User management for administrators."),
          bullet("Lists all users with plan, role, and subscription status."),
          bullet("Allows role changes (user ↔ admin)."),
          bullet("Shows user creation date and subscription details."),

          heading2("5.9 Admin Cases (/admin/cases)"),
          para("Purpose: Case management view across all client mail batches."),
          bullet("Lists all cases grouped by caseId with bureau, round, and status."),
          bullet("Links to individual case detail page."),

          heading2("5.10 Admin Case Detail (/admin/case/:id)"),
          para("Purpose: Full timeline view for a single case."),
          bullet("Shows all mail batches and their delivery events."),
          bullet("Lists client responses for the case."),
          bullet("Provides Day-34 reminder and remail actions."),

          heading2("5.11 Admin Audit (/admin/audit)"),
          para("Purpose: Compliance audit log viewer."),
          bullet("Paginated list of all admin actions with actor, action, target, and timestamp."),
          bullet("Read-only view for compliance review."),

          heading2("5.12 Admin Bulk (/admin/bulk)"),
          para("Purpose: Bulk operations on eligible cases."),
          bullet("Shows cases eligible for Day-34 follow-ups (created 34+ days ago)."),
          bullet("Allows bulk selection and bulk send of Day-34 reminder emails."),

          heading2("5.13 Key Components"),
          heading3("CreditReportUploader"),
          bullet("Handles file selection and upload to Object Storage via signed URLs."),
          bullet("Supports PDF, TXT, and Metro 2 binary formats."),
          bullet("Triggers analysis pipeline on successful upload."),

          heading3("AIChat"),
          bullet("Floating chat interface powered by OpenAI GPT-5."),
          bullet("Context-aware: injects user's plan and detected violations into system prompt."),
          bullet("Conversation history persisted in chat_conversations table."),

          heading3("ReportReview"),
          bullet("Renders structured analysis results from an analysis run."),
          bullet("Groups issues by severity and bureau."),
          bullet("Provides dispute letter generation CTA."),

          heading3("PrintPreviewModal"),
          bullet("Modal overlay showing formatted letter content."),
          bullet("Allows printing or downloading the letter as PDF."),

          heading3("OnboardingModal"),
          bullet("Shown to new users on first login."),
          bullet("Walks through uploading first report and selecting a plan."),

          pageBreak(),

          // ── 6. BACKEND ROUTES PRD ────────────────────────────────────────────
          heading1("6. Backend Routes PRD"),

          heading2("6.1 Authentication Routes"),
          makeTable(
            ["Method", "Path", "Auth", "Description"],
            [
              ["POST", "/api/user/register", "None", "Register new user with email + password"],
              ["POST", "/api/user/login", "None", "Passport local strategy login, sets session"],
              ["POST", "/api/user/logout", "requireAuth", "Destroys session"],
              ["GET", "/api/user/me", "requireAuth", "Returns current user profile"],
              ["POST", "/api/admin/auth/login", "None", "Admin local login"],
              ["POST", "/api/admin/auth/logout", "None", "Admin logout"],
            ]
          ),

          heading2("6.2 Credit Report Routes"),
          makeTable(
            ["Method", "Path", "Auth", "Description"],
            [
              ["GET", "/api/credit-reports", "requireAuth", "List user's reports"],
              ["POST", "/api/credit-reports", "requireAuth", "Create report record post-upload"],
              ["GET", "/api/credit-reports/:id", "requireAuth", "Get single report"],
              ["DELETE", "/api/credit-reports/:id", "requireAuth", "Soft-delete report"],
              ["POST", "/api/credit-reports/:id/analyze", "requireAuth + subscription", "Run analysis pipeline"],
              ["POST", "/api/credit-reports/:id/force-reanalyze", "requireAuth + subscription", "Force re-run analysis"],
            ]
          ),

          heading2("6.3 Dispute Letter Routes"),
          makeTable(
            ["Method", "Path", "Auth", "Description"],
            [
              ["GET", "/api/dispute-letters", "requireAuth", "List user's letters"],
              ["POST", "/api/dispute-letters/generate", "requireAuth + subscription", "Generate AI dispute letter"],
              ["GET", "/api/dispute-letters/:id", "requireAuth", "Get letter content"],
              ["POST", "/api/dispute-letters/:id/mail", "requireAuth + subscription", "Dispatch via Click2Mail"],
              ["GET", "/api/dispute-letters/:id/pdf", "requireAuth", "Stream PDF"],
            ]
          ),

          heading2("6.4 Chat Routes"),
          makeTable(
            ["Method", "Path", "Auth", "Description"],
            [
              ["GET", "/api/chat", "requireAuth", "Get conversation history"],
              ["POST", "/api/chat", "requireAuth", "Send message, get AI reply"],
              ["DELETE", "/api/chat", "requireAuth", "Clear conversation history"],
            ]
          ),

          heading2("6.5 Admin Routes"),
          makeTable(
            ["Method", "Path", "Auth", "Description"],
            [
              ["GET", "/api/admin/whoami", "adminOnly", "Admin session introspection"],
              ["GET", "/api/admin/stats", "adminOnly", "Aggregate statistics"],
              ["GET", "/api/admin/users", "adminOnly", "List all users"],
              ["PUT", "/api/admin/users/:id/role", "adminOnly", "Update user role"],
              ["GET", "/api/admin/cases", "adminOnly", "List all mail batch cases"],
              ["GET", "/api/admin/cases/:id", "adminOnly", "Case timeline detail"],
              ["GET", "/api/admin/cases/eligible-day34", "adminOnly", "Cases eligible for Day-34 reminder"],
              ["POST", "/api/admin/cases/bulk-remind-day34", "adminOnly", "Bulk Day-34 reminders"],
              ["GET", "/api/admin/letters", "adminOnly", "All mail batches with delivery info"],
              ["POST", "/api/admin/letters/:id/remind-day34", "adminOnly", "Send Day-34 reminder for batch"],
              ["POST", "/api/admin/letters/:id/remail", "adminOnly", "Re-mail a letter"],
              ["GET", "/api/admin/responses", "adminOnly", "Client uploaded bureau responses"],
              ["GET", "/api/admin/audit", "adminOnly", "Audit log"],
              ["GET", "/api/download/architecture-doc", "adminOnly", "Download this document"],
            ]
          ),

          heading2("6.6 Utility Routes"),
          makeTable(
            ["Method", "Path", "Auth", "Description"],
            [
              ["GET", "/api/version", "None", "Build version info"],
              ["GET", "/objects/:path", "requireAuth", "ACL-protected object storage file download"],
              ["POST", "/api/objects/upload", "requireAuth", "Get signed upload URL"],
              ["POST", "/api/stripe/webhook", "None (Stripe sig)", "Stripe subscription event handler"],
              ["GET", "/api/stripe/plans", "None", "Available subscription plans"],
            ]
          ),
          pageBreak(),

          // ── 7. SERVICES PRD ───────────────────────────────────────────────────
          heading1("7. Services PRD"),

          heading2("7.1 advancedCreditAnalysis.ts"),
          para("Orchestrates the full AI analysis pipeline from rules to explanations."),
          bullet("Input: CreditReport model"),
          bullet("Step 1: Calls runAllRules() → IssueFlag[]"),
          bullet("Step 2: Calls GPT-5 with all issues → AiIssueExplanation[]"),
          bullet("Step 3: Computes summary string"),
          bullet("Output: AnalysisResult { issues, aiExplanations, summary }"),
          bullet("Graceful degradation: if OpenAI unavailable, returns issues without AI explanations."),

          heading2("7.2 creditReportParserV2.ts"),
          para("AI-powered parser that converts raw credit report text into a structured CreditReport model."),
          bullet("Input: raw text string, bureau hint, provider name, userId"),
          bullet("Calls GPT-5 with a structured extraction prompt."),
          bullet("Output: CreditReport with bureaus[], tradelines[], collections[], consumer info."),
          bullet("Fallback: attempts regex-based parsing if AI fails."),

          heading2("7.3 letterGenerator.ts"),
          para("Generates dispute letter text content and converts to PDF buffer."),
          bullet("Input: CreditReportViolation[], bureau string, ClientInfo"),
          bullet("Produces business-letter formatted text content."),
          bullet("Converts text to HTML then to basic PDF buffer."),
          bullet("Also provides generateCFPBPacketPDF() for CFPB complaint packets."),

          heading2("7.4 aiLetterDrafting.ts"),
          para("AI-powered dispute letter drafting with round-based escalation logic."),
          bullet("Input: ViolationSummary[], AiIssueExplanation[], ConsumerInfo, BureauName, round (1|2|3)"),
          bullet("Round 1: Initial dispute — professional, firm tone."),
          bullet("Round 2: Follow-up — references prior dispute, warns of CFPB complaint."),
          bullet("Round 3: Final notice — cites willful non-compliance, statutory damages, legal action."),
          bullet("Contains FCRA_STATUTE_CITATIONS map for 25+ FCRA/FDCPA/Metro2 sections."),
          bullet("Fallback: generateTemplateDisputeLetter() for offline operation."),

          heading2("7.5 click2mail.ts"),
          para("Integration with Click2Mail REST API for physical mail dispatch."),
          bullet("Input: sender/recipient addresses, base64 PDF document"),
          bullet("POST /jobs → Click2Mail: returns jobId and trackingNumber."),
          bullet("GET /jobs/:id: polls delivery status."),
          bullet("submitLetter() is the high-level helper used by routes."),
          bullet("Return address configured via C2M_RETURN_ADDRESS_JSON env var."),

          heading2("7.6 freezeAgent.ts"),
          para("Automates credit freeze/unfreeze requests across all three bureaus."),
          bullet("Input: FreezeUserInfo (name, address, SSN last 4, DOB)"),
          bullet("Submits freeze requests to Equifax, TransUnion, and Experian APIs."),
          bullet("Returns per-bureau status and confirmation numbers."),
          bullet("Used in Done-For-You workflow to protect consumer credit during dispute."),

          heading2("7.7 openai.ts"),
          para("Core OpenAI utility functions shared across the application."),
          bullet("analyzeCreditReport(): GPT-5 analysis of raw credit report text."),
          bullet("generateDisputeLetter(): GPT-5 letter generation (legacy route)."),
          bullet("chatWithAI(): Powers the AIChat component with plan-aware context."),
          bullet("generateCFPBComplaint(): Produces CFPB complaint narrative with case law."),
          bullet("Model selection: gpt-5 via Replit AI Integrations; gpt-4o as direct fallback."),
          pageBreak(),

          // ── 8. AI LOGIC PRD ───────────────────────────────────────────────────
          heading1("8. AI Logic PRD"),

          heading2("8.1 Overview — Three-Step AI Pipeline"),
          para("The platform uses AI in three distinct steps, each building on the previous:"),
          bullet("Step 1 — Credit Report Parsing: GPT-5 extracts structured data from raw PDF text."),
          bullet("Step 2 — Issue Explanation & Prioritization: GPT-5 humanizes rules engine output."),
          bullet("Step 3 — Dispute Letter Drafting: GPT-5 writes legally compliant letters."),

          heading2("8.2 Step 1: Credit Report Parsing"),
          para("Model: GPT-5 (response_format: json_object)"),
          para("System prompt: 'You are a credit report parsing expert…'"),
          para("User prompt: structured extraction instruction + raw report text."),
          para("Output: JSON with consumer info, bureaus[], tradelines[], collections[], inquiries[]."),
          para("Fallback: regex-based parser if GPT fails or text quality insufficient."),

          heading2("8.3 Step 2: Issue Explanation & Prioritization"),
          para("Model: GPT-5 (response_format: json_object)"),
          para("System prompt: 'You are an expert credit repair analyst specializing in FCRA, FDCPA, and Metro2 compliance.'"),
          para("User prompt: list of all IssueFlag objects with ruleId, category, description, affected bureaus."),
          para("Output JSON schema per issue:"),
          bullet("issueId — references IssueFlag.id"),
          bullet("accountLabel — readable account name"),
          bullet("humanSummary — plain-language explanation"),
          bullet("statutes — array of legal citations"),
          bullet("disputeAngle — INACCURATE | UNVERIFIABLE | OBSOLETE | MISLEADING | HARDSHIP_MISREPORTING"),
          bullet("recommendedAction — specific corrective action"),
          bullet("priority — integer 1 (most urgent) to 5 (least urgent)"),
          para("Fallback: returns raw IssueFlag descriptions if GPT fails."),

          heading2("8.4 Step 3: Dispute Letter Drafting"),
          para("Model: GPT-4o (aiLetterDrafting.ts) / GPT-5 (openai.ts)"),
          para("System prompt: 'You are an expert credit repair specialist who drafts legally compliant, effective dispute letters.'"),
          para("User prompt includes:"),
          bullet("Consumer personal information (name, address, DOB, SSN last 4)"),
          bullet("Target bureau and round number"),
          bullet("Round-specific escalation instructions (getRoundInstructions)"),
          bullet("Formatted violation list with FCRA citations, dispute angles, recommended actions"),
          para("Round escalation:"),
          bullet("Round 1: Initial dispute — introduces consumer, requests 30-day investigation under FCRA §1681i."),
          bullet("Round 2: Follow-up — references failed prior dispute, cites §1681i(a)(5), warns of CFPB complaint."),
          bullet("Round 3: Final notice — cites §1681n willful non-compliance, $100–$1,000 statutory damages, legal action intent."),
          para("Temperature: 0.4 (deterministic but not robotic). Max tokens: 3,000."),

          heading2("8.5 Model Selection Logic"),
          bullet("If AI_INTEGRATIONS_OPENAI_BASE_URL + AI_INTEGRATIONS_OPENAI_API_KEY → Replit AI gateway → gpt-5"),
          bullet("If OPENAI_API_KEY → direct OpenAI → gpt-5 (or OPENAI_MODEL env override)"),
          bullet("If neither configured → AI features disabled, fallback to template letters."),
          pageBreak(),

          // ── 9. RULES ENGINE PRD ───────────────────────────────────────────────
          heading1("9. Rules Engine PRD"),

          heading2("9.1 Overview"),
          para(
            "The rules engine is a deterministic, code-driven compliance checker defined in " +
            "server/rules/engine.ts. It runs 13 rule sets in sequence and deduplicates " +
            "results by ruleId + affectedIds."
          ),

          heading2("9.2 Rule Sets"),
          makeTable(
            ["Rule Set", "File", "Focus"],
            [
              ["Balance Rules", "rules_balances.ts", "Charged-off accounts showing balance, balance exceeding credit limit"],
              ["Status Rules", "rules_status.ts", "Invalid account status codes, inconsistent status/balance combos"],
              ["Timeline Rules", "rules_timeline.ts", "Missing DOFD, obsolete accounts (7-year SOL), impossible date sequences"],
              ["Collection Rules", "rules_collections.ts", "Missing original creditor, duplicate collection entries"],
              ["Identity Rules", "rules_identity.ts", "Consumer info discrepancies across bureaus"],
              ["Dispute Rules", "rules_disputes.ts", "Disputed accounts not marked correctly per Metro 2 (XB special comment)"],
              ["FCRA Enhanced", "rules_fcra_enhanced.ts", "Advanced FCRA §1681e(b), §1681i, §1681s-2 violations"],
              ["Disputable Rules", "rules_disputable.ts", "All derogatory items flagged as disputable (catch-all)"],
              ["Comprehensive FCRA", "rules_fcra_comprehensive.ts", "Full FCRA rule library — 20+ rule checks"],
              ["Comprehensive FDCPA", "rules_fdcpa_comprehensive.ts", "FDCPA §1692e, §1692f, §1692g violations"],
              ["Metro 2", "rules_metro2_comprehensive.ts", "Metro 2 format compliance — missing K1/K2 segments, invalid codes"],
              ["Cross-Bureau Training", "rules_cross_bureau_training.ts", "R1–R6: balance/status discrepancies across bureaus"],
              ["Expanded FCRA", "rules_expanded_fcra.ts", "25+ additional per-account validation rules"],
            ]
          ),

          heading2("9.3 Cross-Bureau Audit Logic"),
          para("Rules R1–R6 compare the same account across Equifax, TransUnion, and Experian:"),
          bullet("R1: Balance mismatch — same account shows different balance at two or more bureaus."),
          bullet("R2: Status mismatch — delinquency level differs across bureaus."),
          bullet("R3: Open date mismatch — account opened date differs across bureaus."),
          bullet("R4: DOFD mismatch — date of first delinquency differs across bureaus."),
          bullet("R5: Payment history mismatch — same month shows different status at two bureaus."),
          bullet("R6: High credit / credit limit mismatch."),

          heading2("9.4 Statute of Limitations Checks"),
          bullet("Negative items must be removed after 7 years from DOFD (FCRA §1681c(a))."),
          bullet("Bankruptcies: 10 years."),
          bullet("Collections: 7 years from DOFD of original debt."),
          bullet("Rules flag any account beyond these limits still appearing on reports."),
          pageBreak(),

          // ── 10. PAYMENTS & SUBSCRIPTION PRD ──────────────────────────────────
          heading1("10. Payments & Subscription PRD"),

          heading2("10.1 Stripe Integration"),
          bullet("Stripe SDK initialized with STRIPE_SECRET_KEY."),
          bullet("Webhook endpoint /api/stripe/webhook verifies Stripe signature before processing."),
          bullet("Webhook events handled: customer.subscription.created, .updated, .deleted, payment_intent.succeeded."),
          bullet("User record updated on each webhook: subscriptionStatus, subscriptionExpiresAt, stripeSubscriptionId."),

          heading2("10.2 Plan Tiers"),
          makeTable(
            ["Plan", "Key", "Features"],
            [
              ["DIY", "DIY", "Upload reports, view analysis, generate letters, manual mailing"],
              ["Done-For-You", "DONE_FOR_YOU", "All DIY + automated Click2Mail dispatch, freeze agent, follow-up emails"],
              ["Enterprise", "ENTERPRISE", "All Done-For-You + bulk operations, advanced admin, priority support"],
            ]
          ),

          heading2("10.3 Subscription Lifecycle"),
          bullet("User registers → subscriptionStatus = 'inactive'."),
          bullet("User subscribes via Stripe Checkout → webhook fires → status = 'active'."),
          bullet("Renewal: webhook fires on each billing cycle, status remains 'active'."),
          bullet("Cancellation: status = 'cancelled' at end of billing period."),
          bullet("Past due: status = 'past_due' after failed payment."),
          bullet("requireActiveSubscription middleware blocks feature access if status ≠ 'active'."),
          pageBreak(),

          // ── 11. PHYSICAL MAIL PRD ─────────────────────────────────────────────
          heading1("11. Physical Mail PRD"),

          heading2("11.1 Click2Mail Integration"),
          bullet("API: https://rest.click2mail.com/molpro/restservice.svc"),
          bullet("Authentication: Bearer token (CLICK2MAIL_API_KEY env var)."),
          bullet("Mail class: FIRST_CLASS; envelope: WHITE_STANDARD; color: FULL_COLOR."),
          bullet("Return address configured via C2M_RETURN_ADDRESS_JSON env var."),

          heading2("11.2 Mail Batch Lifecycle"),
          bullet("Admin or system triggers letter dispatch → mail_batches record created (status: queued)."),
          bullet("click2mailService.submitLetter() called → Click2Mail job created → click2mail_job_id stored."),
          bullet("Webhook or polling updates status: queued → processing → mailed."),
          bullet("delivery_events table records all webhook events for full audit trail."),
          bullet("USPS tracking number stored in mail_batches.usps_tracking."),

          heading2("11.3 Day-34 Follow-Up Flow"),
          bullet("Admin views /admin/cases/eligible-day34 — batches mailed 34+ days ago."),
          bullet("System mints one-time action tokens (yes/no/upload) for the client."),
          bullet("notificationService.sendDay34FollowUp() sends personalized email with token links."),
          bullet("Client clicks link → token consumed → client_responses record created."),
          bullet("Admin reviews response and initiates Round 2 or closes case."),
          pageBreak(),

          // ── 12. ADMIN CONSOLE PRD ─────────────────────────────────────────────
          heading1("12. Admin Console PRD"),

          heading2("12.1 Features"),
          bullet("User Management — list all users, change roles (user ↔ admin)."),
          bullet("Case Management — view all cases, drill into timeline, delivery events, client responses."),
          bullet("Letters — list all mail batches, re-mail letters, send Day-34 reminders."),
          bullet("Bulk Operations — select multiple eligible cases, bulk send Day-34 reminders."),
          bullet("Audit Log — immutable chronological log of all admin actions."),
          bullet("System Dashboard — build version, OpenAI configuration status, diagnostic endpoints."),
          bullet("Architecture Doc Download — generate and download this document on demand."),

          heading2("12.2 Access Control"),
          bullet("All /api/admin/* routes guarded by adminOnly middleware."),
          bullet("adminOnly checks req.user.role === 'admin' or admin session presence."),
          bullet("Separate admin credential store (admin_credentials) from user accounts."),
          bullet("All admin actions logged to admin_audit_logs with actor, action, target, meta."),
          pageBreak(),

          // ── 13. SECURITY & AUTH PRD ───────────────────────────────────────────
          heading1("13. Security & Auth PRD"),

          heading2("13.1 Authentication"),
          bullet("User auth: Passport.js local strategy — verifies email + password against user_credentials (bcrypt)."),
          bullet("Admin auth: Separate Passport strategy — verifies username + password against admin_credentials."),
          bullet("Sessions stored in PostgreSQL sessions table via connect-pg-simple."),
          bullet("Session cookie: httpOnly, sameSite=strict, secure in production."),

          heading2("13.2 Authorization"),
          bullet("requireAuth middleware: checks req.session.userId — 401 if missing."),
          bullet("requireActiveSubscription middleware: checks user.subscriptionStatus === 'active' — 403 if not."),
          bullet("adminOnly middleware: checks user.role === 'admin' or admin session — 403 otherwise."),

          heading2("13.3 Object Storage ACL"),
          bullet("All user uploads stored in .private/ bucket path."),
          bullet("ObjectStorageService.canAccessObjectEntity() checks ownership before serving files."),
          bullet("Path traversal prevention: rejects paths containing '..' or URL-encoded variants."),
          bullet("Content-Disposition: attachment forced to prevent XSS via browser inline rendering."),

          heading2("13.4 Rate Limiting"),
          bullet("Custom sliding-window rate limiter (server/middleware/rateLimit.ts)."),
          bullet("Applied to auth endpoints and AI-intensive routes."),
          bullet("Returns 429 with Retry-After header when limit exceeded."),

          heading2("13.5 Input Validation"),
          bullet("All POST body inputs validated with Zod schemas derived from drizzle-zod."),
          bullet("Unknown properties stripped by Zod .strip() (default)."),
          bullet("File uploads validated for MIME type and size before processing."),
          pageBreak(),

          // ── 14. FEATURE ROADMAP ───────────────────────────────────────────────
          heading1("14. Feature Roadmap / Key Features Summary"),

          heading2("7 Core Features"),
          new Paragraph({
            children: [
              new TextRun({ text: "1. Credit Report Upload & Parsing — ", bold: true }),
              new TextRun("Upload PDF, TXT, or Metro 2 binary credit reports; AI extracts structured data from all three bureaus."),
            ],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "2. Advanced Rules Engine — ", bold: true }),
              new TextRun("13 rule sets detect FCRA, FDCPA, Metro 2, and cross-bureau violations automatically."),
            ],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "3. AI-Powered Dispute Letter Generation — ", bold: true }),
              new TextRun("GPT-5 drafts bureau-specific letters with per-round escalation (Initial → Follow-Up → Final Notice)."),
            ],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "4. Physical Mail Automation — ", bold: true }),
              new TextRun("Click2Mail dispatches certified USPS letters with full delivery tracking."),
            ],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "5. AI Chat Assistant — ", bold: true }),
              new TextRun("GPT-5 powered chat with plan and violation context for guided user support."),
            ],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "6. Subscription Billing — ", bold: true }),
              new TextRun("Stripe-powered DIY, Done-For-You, and Enterprise tiers with webhook-driven lifecycle management."),
            ],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "7. Admin Console — ", bold: true }),
              new TextRun("Full-featured admin panel for user management, case tracking, bulk operations, and immutable audit logs."),
            ],
            spacing: { after: 100 },
          }),

          para(""),
          para("— End of Document —", false),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: "Credit Repair SaaS Platform | Architecture & PRD | March 31, 2026", color: "888888", size: 18 })],
          }),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outputPath, buffer);
  console.log(`✅ Architecture doc written to ${outputPath} (${buffer.length} bytes)`);
}

