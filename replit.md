# Personal Credit Pros - AI-Powered Credit Repair Platform

## Overview

Personal Credit Pros is a comprehensive credit repair automation platform that leverages AI to analyze credit reports, identify FCRA and Metro2 violations, generate dispute letters, and manage the entire dispute lifecycle. The platform offers both DIY and Done-For-You service tiers with automated mailing, CRM integration, and client communication features.

The system is built as a full-stack web application using React frontend with TypeScript, Express/FastAPI backend, and PostgreSQL database with Drizzle ORM. It integrates with multiple third-party services for payment processing (Stripe), mail delivery (Click2Mail), notifications (Twilio, Gmail), and AI-powered document analysis.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React with TypeScript and Vite build system

**UI Components**: Radix UI component library with shadcn/ui styling framework using Tailwind CSS with custom design tokens for consistent theming

**State Management**: TanStack Query (React Query) for server state management with optimistic updates and automatic cache invalidation

**Routing**: Wouter for lightweight client-side routing with role-based access control

**User Interface Components**:
- OnboardingModal - First-time user welcome with feature overview (localStorage-based persistence)
- PrintPreviewModal - Letter preview with print/download/Click2Mail actions
- DocumentHistoryPanel - Sliding sidebar for tracking uploaded credit reports
- PRDViewerPanel - Tabbed documentation viewer for platform features
- UserProfile Page - Account settings, saved documents, and subscription tier management

**Key Design Decisions**:
- Monorepo structure with shared schema types between client and server (`@shared` alias)
- Component-based architecture with reusable UI primitives
- Responsive design with mobile-first approach using Tailwind breakpoints
- Real-time updates through React Query's automatic refetching

### Backend Architecture

**Framework**: Express.js with TypeScript on Node.js runtime

**API Design**: RESTful API with JSON payloads and standardized error handling

**Authentication**: OpenID Connect (OIDC) integration with Replit Auth using Passport.js strategies and session-based authentication stored in PostgreSQL

**Authorization**: Role-based access control (RBAC) with `user` and `admin` roles enforced via middleware guards (`adminOnly`, `isAuthenticated`)

**API Endpoints**:
- `GET /api/auth/user` - Retrieve authenticated user profile
- `PATCH /api/auth/profile` - Update user first name and last name
- `POST /api/credit-reports/upload` - Upload credit report for analysis
- `GET /api/credit-reports` - List user's credit reports
- `GET /api/violations` - List detected violations
- `POST /api/dispute-letters/generate` - Generate dispute letter with AI
- `GET /api/dispute-letters` - List user's dispute letters
- `GET /api/dispute-letters/:id/download` - Download letter PDF
- `POST /api/admin/login` - Admin password-based authentication
- `POST /api/admin/logout` - Admin session termination with regeneration
- `GET /api/admin/check` - Verify admin authentication status
- `GET /api/admin/stats` - Aggregate platform statistics (admin-only)

**Key Design Decisions**:
- Modular service layer separating business logic from route handlers
- Separate admin routes with strict access control (`adminRouter`)
- Session management using PostgreSQL-backed session store for persistence
- Environment-based configuration for production vs development modes

### Data Storage

**Primary Database**: PostgreSQL via Neon serverless with WebSocket support for scalability

**ORM**: Drizzle ORM for type-safe database queries with schema-first design

**Schema Design**:
- `users` - Core user profiles with plan tier and payment identifiers
- `adminCredentials` - Password-hashed admin login credentials (bcrypt, 10 rounds)
- `creditReports` - Uploaded reports with analysis status and results
- `violations` - Detected FCRA/Metro2 violations linked to reports
- `disputeLetters` - Generated dispute letters with mailing status
- `mailBatches` - Tracking for physical mail delivery via Click2Mail
- `deliveryEvents` - Delivery status updates and tracking
- `clientResponses` - Client feedback and bureau response uploads
- `actionTokens` - One-time secure tokens for email/SMS action links
- `adminAuditLogs` - Complete audit trail of admin actions

**File Storage**: Local filesystem with configurable directory (`FILES_DIR` environment variable) for uploaded documents and generated PDFs

**Key Design Decisions**:
- UUID primary keys for distributed scalability
- JSONB fields for flexible storage of analysis results and metadata
- Timestamp tracking on all records for audit compliance
- Separate sessions table for authentication persistence

### AI & Document Processing

**AI Provider**: OpenAI GPT-5 (latest model) for credit report analysis, violation detection, and dispute letter generation

**OCR Processing**: Tesseract.js with pdf2pic for extracting text from PDF and image uploads

**Local AI Fallback**: Ollama integration for on-premise AI processing when available

**Key Design Decisions**:
- Structured prompts for consistent violation detection across FCRA statutes
- JSON response format from AI for reliable parsing
- Severity classification (HIGH/MEDIUM/LOW) for prioritization
- Case law citation integration for legal compliance

### External Dependencies

**Payment Processing**:
- Stripe integration (React Stripe.js) for subscription management and payment processing
- Optional integration with graceful degradation when API key is missing
- Environment-specific test vs production modes

**Mail Delivery**:
- Click2Mail REST API for automated physical letter mailing
- First-class mail with full-color printing support
- Tracking number generation and delivery status webhooks

**Communication Services**:
- Twilio (planned) for SMS notifications and reminders
- Gmail SMTP or API for email notifications
- Automated day-34 follow-up sweeps via cron scheduler

**CRM Integration**:
- Credit Repair Cloud (CRC) API integration for syncing client data
- Automated dispute tracking and status updates

**Development Tools**:
- Replit-specific plugins for runtime error overlay and dev tooling
- Cartographer and dev banner for Replit environment integration

**Credit Freeze Automation**:
- Puppeteer-based browser automation for submitting credit freeze and opt-out requests
- Supports LexisNexis (freeze + report request), Cotality, Innovis, OptOutPrescreen, and SageStream
- Headless Chromium with Replit-safe flags (--no-sandbox, --disable-setuid-sandbox)
- Asynchronous execution to avoid blocking API responses
- Graceful handling of CAPTCHAs and verification challenges

### Security & Compliance

**Authentication Security**:
- User authentication: Replit OIDC integration with secure token refresh
- Admin authentication: Password-based with bcrypt hashing (10 rounds)
- Dual session system: Separate cookies for user (`connect.sid`) and admin (`admin_session`)
- Session regeneration on login/logout prevents fixation attacks
- HTTPS-only cookie sessions with configurable TTL (7 days default)
- CSRF protection via same-site cookie policies

**Data Protection**:
- PII redaction for internal storage of credit reports
- Secure one-time action tokens with expiration and consumption tracking
- Admin audit logging for all sensitive operations

**Payment Security**:
- PCI compliance through Stripe hosted payment pages
- No direct credit card handling in application code
- Subscription ID storage for billing management without sensitive data

### Automation & Workflows

**Scheduled Tasks**:
- Hourly sweep for 34-day follow-up notifications
- Automated status checks and client reminders
- Letter generation queue processing

**Notification System**:
- Multi-channel delivery (email, SMS)
- Template-based messaging with dynamic content
- Secure one-time action links for client responses

**Admin Capabilities**:
- Password-based admin authentication (separate from user OIDC sessions)
- Admin credentials: username='admin', password='CCPros10miL$$', email='admin@personalcreditpros.com'
- Separate admin session cookie (`admin_session`) prevents cross-session interference
- Admin System Dashboard (`/admin/system`) - aggregate platform statistics:
  - Total users, active subscriptions, credit reports analyzed
  - Dispute letters generated, pending mail batches, violations detected
  - Real-time statistics fetched from dedicated API endpoint
- Bulk operations for letter generation and mailing
- User management with role assignment
- Case tracking and response processing
- Complete audit trail with actor tracking