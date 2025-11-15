-- USERS
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'user',
  tier TEXT DEFAULT 'Basic',
  created_at TIMESTAMP DEFAULT NOW()
);

-- SIGNATURE LOGS
CREATE TABLE IF NOT EXISTS signature_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  file_name TEXT,
  url TEXT,
  signed_at TIMESTAMP DEFAULT NOW()
);

-- AUDIT LOGS
CREATE TABLE IF NOT EXISTS signing_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  pdf_path TEXT,
  signed_at TIMESTAMP DEFAULT NOW(),
  ip_address TEXT
);

-- FILE UPLOADS
CREATE TABLE IF NOT EXISTS files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  filename TEXT,
  storage_url TEXT,
  uploaded_at TIMESTAMP DEFAULT NOW()
);

-- EMAIL LOGS
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT,
  event_type TEXT,
  status TEXT,
  token_used TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);