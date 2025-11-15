# CreditCareConnect: Supabase-Integrated Build

## ✅ What’s Inside
- Supabase integration for auth, DB, and file storage
- Email log tracking system
- Secured Swagger Docs (admin-token protected)
- Admin UI + PRD viewer + document handling
- Supabase SQL schema included

## 🔧 Setup Steps

1. Create project at https://supabase.com
2. Run `supabase_schema.sql` via SQL Editor
3. Create storage bucket `documents` (optional)
4. Set `.env` using `.env.template`
5. Start backend:
   ```bash
   npm install
   npx tsx server/index.ts
   ```

6. Access API Docs:
   http://localhost:4000/docs (requires header: x-admin-token=admin-doc-token)

## ✉️ Notes
Email sending is simulated; replace with production service.
Storage and user roles protected by Supabase RLS.

Enjoy!