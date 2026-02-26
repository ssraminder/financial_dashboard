-- Create exports table to track background CSV export jobs
create table if not exists public.exports (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id),
  status text not null default 'processing' check (status in ('processing', 'completed', 'failed')),
  file_name text not null,
  file_path text,
  file_size bigint,
  row_count integer,
  filters jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamp with time zone not null default now(),
  completed_at timestamp with time zone
);

create index idx_exports_user_id on public.exports(user_id);
create index idx_exports_status on public.exports(status);

-- RLS policies
alter table public.exports enable row level security;

create policy "Users can view their own exports"
  on public.exports for select
  using (auth.uid() = user_id);

create policy "Users can insert their own exports"
  on public.exports for insert
  with check (auth.uid() = user_id);

-- Create storage bucket for exports (if it doesn't exist)
insert into storage.buckets (id, name, public)
values ('exports', 'exports', false)
on conflict (id) do nothing;

-- Storage policy: users can download their own exports
create policy "Users can read own exports"
  on storage.objects for select
  using (bucket_id = 'exports' and auth.uid()::text = (storage.foldername(name))[1]);
