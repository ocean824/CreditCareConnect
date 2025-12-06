# Personal Credit Pros - AI-Powered Credit Repair Platform

## Overview
Personal Credit Pros is an AI-driven credit repair automation platform designed to analyze credit reports, identify FCRA and Metro2 violations, generate dispute letters, and manage the entire dispute lifecycle. It offers both DIY and Done-For-You service tiers, incorporating automated mailing, CRM integration, and client communication. The platform is a full-stack web application utilizing React, TypeScript, Express, PostgreSQL, and Drizzle ORM, integrating with various third-party services for payments, mail delivery, notifications, and AI-powered document analysis.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The frontend is built with React and TypeScript, using Vite. It employs Radix UI and shadcn/ui with Tailwind CSS for styling, and TanStack Query for state management with optimistic updates. Wouter handles client-side routing with role-based access control. Key components include `OnboardingModal`, `PrintPreviewModal`, `DocumentHistoryPanel`, `PRDViewerPanel`, and `UserProfile` page. The design emphasizes a monorepo structure, component-based architecture, responsive design, and real-time updates.

### Backend Architecture
The backend is an Express.js application with TypeScript on Node.js, providing a RESTful API with JSON payloads. It features email/password-based user authentication and a separate admin authentication, both using bcrypt and PostgreSQL-backed session stores. Role-based access control (RBAC) with `user` and `admin` roles, along with subscription-gating, ensures secure access. Key API endpoints manage user and admin authentication, profile updates, and protected operations for credit report uploads, violation listings, and dispute letter generation. The architecture promotes modularity, strict access control, and environment-based configuration.

### Data Storage
The primary database is PostgreSQL via Neon, leveraging Drizzle ORM for type-safe queries. The schema includes tables for `users`, `userCredentials`, `adminCredentials`, `sessions`, `creditReports`, `violations`, `disputeLetters`, `mailBatches`, `deliveryEvents`, `clientResponses`, `actionTokens`, and `adminAuditLogs`. Design decisions include UUID primary keys, JSONB fields for metadata, and timestamp tracking for audit compliance.

#### File Storage (Replit Object Storage) - December 2025
Credit report PDFs and uploaded documents are stored in Replit Object Storage for persistence across deployments:
- **Bucket**: `replit-objstore-a531df73-5340-40f0-a8f9-c84ee0bce191`
- **PRIVATE_OBJECT_DIR**: `/replit-objstore-.../.private` (includes bucket name)
- **Service Files**:
  - `server/objectStorage.ts` - Object Storage client with upload/download/delete
  - `server/objectAcl.ts` - ACL policy management
  - `server/fileAssetResolver.ts` - Unified file handling for legacy and new files
- **File URL Types**:
  - `/files/...` - Legacy local files
  - `/objects/...` - New Object Storage files
  - `https://storage.googleapis.com/...` - Legacy GCS URLs (auto-normalized to /objects/)
- **API Endpoints**:
  - `POST /api/upload-file` - Uploads file to Object Storage, returns `/objects/uploads/<uuid>.<ext>`
  - `GET /objects/:objectPath` - Serves files from Object Storage (requires auth, XSS protected)
  - `POST /api/objects/upload` - Gets presigned upload URL
- **ACL**: Files tagged with owner userId; legacy files without ACL allow authenticated read

### AI & Document Processing
The platform utilizes OpenAI GPT-5 for credit report analysis, violation detection, and dispute letter generation. OCR processing is handled by Tesseract.js with pdf2pic for text extraction from PDFs. Supported credit report types include single-bureau (EQUIFAX, TRANSUNION, EXPERIAN) and TRI-MERGE reports, with AI tagging violations to specific bureaus. The system uses structured prompts for consistent violation detection, JSON response formats, and severity classification.

#### Enhanced FCRA Violation Detection (December 2025)
Six new enhanced FCRA rules have been added to detect:
- **DISPUTED_DEBT_COLLECTION**: Violates FCRA 605(c) by continuing collection during dispute
- **INACCURATE_INFO_REPORTED**: Violates FCRA 623(a)(1) for reporting inaccurate information
- **EXPIRED_DATA_REPORTED**: Violates FCRA 605(a) for reporting data beyond 7-year limit
- **BANKRUPTCY_MISCLASSIFICATION**: Violates FCRA 605(a)(1) for incorrect bankruptcy classification
- **DUPLICATE_ACCOUNTS**: Same debt reported multiple times across furnishers
- **STALE_REPORTING_POST_UPDATE**: Outdated data reported after known status changes

These rules include specific FCRA statute citations for stronger dispute letters.

#### Metro 2 Comprehensive Violation Detection (December 2025)
Complete Metro 2 format violation detection covering:
- **Base Segment Violations**: Missing required fields (account number, creditor name, date opened), invalid status/payment codes
- **Account Status Code Violations**: Status-balance conflicts, charge-off without date, delinquent without DOFD
- **Payment Rating Violations**: Impossible payment pattern jumps, gaps in payment history
- **Date Field Violations**: Future dates, closed before opened, DOFD before opened, last payment before opened
- **Balance/Limit Violations**: Balance exceeds credit limit, high credit inconsistencies, negative balances, missing credit limit for revolving accounts
- **K1/K2 Segment Violations**: Missing original creditor (K1), purchased debt documentation (K2), missing DOFD for collections
- **Cross-Bureau Consistency**: Balance discrepancies, status conflicts between bureaus
- **Compliance Condition Violations**: Forbearance delinquency violations, hardship without special comment, obsolete closed accounts, medical debt under $500, medical collection too soon

All Metro 2 violations include proper statute citations (METRO2_BASE_SEGMENT, METRO2_K1_SEGMENT, METRO2_K2_SEGMENT) with corresponding FCRA references in dispute letters.

#### Multi-Strategy Text Extraction
Enhanced text extraction with fallback strategies:
1. Primary: pdf-parse for native PDF text extraction
2. Fallback: OCR via Tesseract.js for scanned documents
3. Automatic quality detection and confidence scoring

#### AI-Powered Dispute Letters
Enhanced AI letter generation with:
- Aggressive, legally-grounded language
- Specific FCRA statute citations (605, 609, 611, 623)
- Round-based escalation (Round 1: dispute, Round 2: intent to sue, Round 3: regulatory threat)
- Consumer-specific personalization

#### Manual Review UI Component
New ReportReview component allows users to:
- Review detected violations before letter generation
- Toggle individual violations for inclusion
- View violation severity and FCRA basis
- Generate letters for selected violations only

#### Robust Bureau Attribution (December 2025)
Enhanced multi-bureau violation handling with:
- **Deep Traversal**: True recursive search of issue objects (up to 15 levels) to find bureau values anywhere in nested structures
- **Bureau Normalization**: Converts abbreviations (EQ, TU, EX, etc.) and handles both string and object inputs with multiple property name checks (bureau, bureauName, bureauCode, bureauAbbreviation, etc.)
- **Data Integrity**: Violations without valid bureau attribution are skipped (not defaulted to EQUIFAX) with logging for diagnostics
- **Multi-Bureau Expansion**: Violations affecting multiple bureaus create separate database records per bureau for accurate letter generation
- **Frontend Validation**: Checks for undefined bureau before API calls with user-friendly error messages

### Security & Compliance
Security measures include bcrypt hashing for user and admin passwords, dual session management with separate HTTPS-only cookies, and CSRF protection. Data protection involves PII redaction and secure one-time action tokens. Payment security is achieved through Stripe's PCI-compliant hosted payment pages.

### Automation & Workflows
Scheduled tasks include hourly sweeps for follow-up notifications and letter generation queue processing. A multi-channel notification system (email, SMS) uses template-based messaging. Admin capabilities encompass a system dashboard for platform statistics, bulk operations, user management, and case tracking, all with an audit trail.

## External Dependencies

**Payment Processing**: Stripe for subscription management and payment processing.
**Mail Delivery**: Click2Mail REST API for automated physical letter mailing.
**Communication Services**: Twilio (planned) for SMS notifications and Gmail SMTP/API for emails.
**CRM Integration**: Credit Repair Cloud (CRC) API for syncing client data.
**Credit Freeze Automation**: Puppeteer-based browser automation for credit freeze and opt-out requests (LexisNexis, Cotality, Innovis, OptOutPrescreen, SageStream).
**Development Tools**: Replit-specific plugins, Cartographer, and dev banner.