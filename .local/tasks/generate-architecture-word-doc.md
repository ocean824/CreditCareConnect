# Generate Architecture & PRD Word Document

## What & Why
Create a downloadable `.docx` Word document that comprehensively documents the credit report analyzer application — covering its full architecture, tech stack, blueprint, and detailed PRD (Product Requirements Document) for every major feature and service.

## Done looks like
- A `CreditRepairApp_Architecture_PRD.docx` file is generated and placed in the `public/` or `downloads/` folder so it can be served and downloaded via the app.
- A temporary download route (`/api/download/architecture-doc`) or a static file link is available so the user can click to download it immediately.
- The document includes all sections listed in the Tasks section below, properly formatted with headings, subheadings, tables, and bullet points as appropriate for a Word document.

## Out of scope
- Ongoing auto-generation or syncing of the document when code changes
- Any changes to the application itself

## Tasks
1. **Install `docx` package** — Install the `docx` npm package which allows generating properly formatted `.docx` Word files programmatically from Node.js.

2. **Write the document generation script** — Create a standalone script (`scripts/generateArchitectureDoc.ts` or `.js`) that uses the `docx` package to build the Word document with the following sections:
   - **Cover Page**: App name ("Credit Repair SaaS Platform"), date (March 31, 2026), version
   - **Table of Contents**: All major sections listed
   - **Executive Summary**: What the app does and who it is for
   - **Tech Stack**: Frontend (React, TypeScript, Vite, Tailwind CSS, shadcn/ui, Wouter, TanStack Query), Backend (Node.js, Express, TypeScript), Database (PostgreSQL + Drizzle ORM), Auth (Passport.js + sessions), AI (OpenAI GPT-4o/GPT-5), Payments (Stripe), Storage (Object Storage abstraction), Mail (Click2Mail API)
   - **System Architecture Blueprint**: Layered diagram description — Client → API Layer → Services → Rules Engine → AI → DB/Storage/Mail
   - **Database Schema**: Table-by-table breakdown with columns and purpose: `users`, `user_credentials`, `admin_credentials`, `credit_reports`, `violations`, `dispute_letters`, `analysis_runs`, `issues`, `ai_issue_explanations`, `mail_batches`, `delivery_events`, `chat_conversations`, `admin_audit_logs`
   - **Frontend Pages & Components PRD**: For each page (`Landing`, `Dashboard`, `Analysis`, `Letters`, `Admin/users`, `Admin/cases`, `Admin/audit`, `Admin/bulk`) describe its purpose, key UI elements, and user flows. For each major component (`CreditReportUploader`, `AIChat`, `ReportReview`, `PrintPreviewModal`, `OnboardingModal`) describe its role and behavior.
   - **Backend Routes PRD**: Document every API route group (`/api/user`, `/api/credit-reports`, `/api/dispute-letters`, `/api/chat`, `/api/admin`) with their methods, inputs, outputs, and middleware (e.g., auth guards, adminOnly).
   - **Services PRD**: For each service file describe its function, inputs, outputs, and how it fits in the pipeline: `advancedCreditAnalysis.ts`, `creditReportParserV2.ts`, `letterGenerator.ts`, `aiLetterDrafting.ts`, `click2mail.ts`, `freezeAgent.ts`, `openai.ts`
   - **AI Logic PRD**: Detailed walkthrough of the three-step AI pipeline — Rules Engine → AI Explanation & Prioritization → AI Dispute Letter Drafting. Include the round-based escalation logic (Round 1/2/3), system prompts used, and model selection logic.
   - **Rules Engine PRD**: Document the FCRA comprehensive rules, Metro 2 compliance rules, cross-bureau audit logic, and statute of limitations checks.
   - **Payments & Subscription PRD**: Stripe integration, plan tiers (DIY, Done-For-You, Enterprise), subscription lifecycle.
   - **Physical Mail PRD**: Click2Mail integration, mail batch lifecycle, delivery event tracking.
   - **Admin Console PRD**: Features available to admins — user management, case management, audit logs, bulk operations.
   - **Security & Auth PRD**: Passport.js local strategy, session storage in PostgreSQL, ACL on object storage, adminOnly middleware.
   - **Feature Roadmap / Key Features Summary**: Numbered list of the 7 main features with brief descriptions.

3. **Add a download endpoint** — In `server/routes.ts`, add a `GET /api/download/architecture-doc` endpoint that runs the generation script on demand and streams the `.docx` file back to the client as a download (or serves a pre-generated static file from `public/`).

4. **Expose a download link in the UI** — Add a simple, clearly labeled "Download Architecture Doc" button in the Admin area (or a standalone `/admin/docs` route) that hits the download endpoint.

## Relevant files
- `shared/schema.ts`
- `server/routes.ts`
- `server/adminRoutes.ts`
- `server/services/advancedCreditAnalysis.ts`
- `server/services/aiLetterDrafting.ts`
- `server/services/letterGenerator.ts`
- `server/services/click2mail.ts`
- `server/services/openai.ts`
- `server/rules/engine.ts`
- `client/src/App.tsx`
- `client/src/pages`
- `client/src/components`
