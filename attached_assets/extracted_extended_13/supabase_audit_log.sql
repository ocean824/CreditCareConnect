create table if not exists signing_audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  pdf_path text,
  signed_at timestamp with time zone default timezone('utc'::text, now()),
  ip_address text
);