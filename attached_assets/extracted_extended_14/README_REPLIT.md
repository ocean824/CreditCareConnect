# CreditCareConnect: Replit Production Stack (PostgreSQL)

## ✅ Features Implemented
- ✍️ Canvas-based digital signature capture
- 📄 PDF signing with watermark and download
- 🧑‍💼 Admin impersonation ("view as user" logic)
- 📊 Realtime analytics charts (mock + DB-compatible)
- 🕵️ Signature audit logging via PostgreSQL
- ⛔ Upload limit checks by user tier

## 🔧 Setup Instructions

1. **PostgreSQL Configuration**
   - Provision PostgreSQL DB on Replit
   - Import `prod_schema.sql` to initialize tables

2. **Environment Variables (.env)**
   ```
   DATABASE_URL=postgresql://user:pass@host:5432/dbname
   SMTP_HOST=smtp.example.com
   SMTP_USER=your@email.com
   SMTP_PASS=yourpassword
   SIGNATURE_BUCKET=signatures
   ADMIN_TOKEN=admin-doc-token
   ```

3. **Start Dev**
   ```bash
   npm install
   npx tsx server/index.ts
   ```

4. **Client**
   ```bash
   cd client
   npm install
   npm run dev
   ```

5. **Routes & Dashboards**
   - Admin Panel: `/admin`
   - User Dashboard: `/dashboard`
   - Signed Receipt: `/receipt`

> This build assumes Supabase has been replaced by direct PostgreSQL access where necessary.