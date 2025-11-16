# PRD_MASTER.md

## Project: CreditCareConnect

### Purpose
CreditCareConnect is a secure, AI-enhanced web application designed to manage credit health, assist users with financial literacy, and provide smart tools for monitoring, planning, and improving credit profiles.

### Personas
- **Admin**: Manages user base, enforces security (TOTP), oversees platform activity
- **End User**: Uses tools for credit tracking, receives insights via AI, secures access with 2FA
- **Support Agent**: Handles user inquiries, reviews flagged accounts

### User Flows
1. User signs up → enables 2FA → accesses dashboard → interacts with AI assistant
2. Admin login → forced TOTP setup → trust device → admin panel access
3. User accesses credit tips → downloads insights → logs out

### Non-Functional Requirements
- 100% offline-first compatibility
- AI response time < 800ms via OpenAI
- Secure session handling with device trust
- Replit runtime, PostgreSQL DB

### Feature Coverage
- [x] Admin Hard Gate w/ TOTP
- [x] Trusted Device Logic
- [x] Backup Codes PDF Export
- [x] AI Assistant Panel (ChatGPT-enhanced)
- [x] Logout + Session Sync
- [ ] Billing Panel (Planned)
