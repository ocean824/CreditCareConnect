-- USERS TABLE
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  role text default 'user',
  tier text default 'Basic',
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- FILES TABLE
create table if not exists files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  filename text not null,
  uploaded_at timestamp with time zone default timezone('utc'::text, now()),
  storage_url text
);

-- EMAIL LOGS TABLE
create table if not exists email_logs (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  event_type text,
  status text,
  token_used text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- RLS (Row Level Security)
alter table files enable row level security;
alter table email_logs enable row level security;

create policy "User can view own files" on files
  for select using (auth.uid() = user_id);

create policy "Admins can view email logs" on email_logs
  for select using (auth.role() = 'authenticated');