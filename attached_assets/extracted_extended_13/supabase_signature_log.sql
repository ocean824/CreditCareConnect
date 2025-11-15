-- SIGNATURE LOGS TABLE
create table if not exists signature_logs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  file_name text,
  url text,
  signed_at timestamp with time zone default timezone('utc'::text, now())
);