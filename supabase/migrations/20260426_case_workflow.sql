create extension if not exists pgcrypto;

create table if not exists public.case_submissions (
  id uuid primary key default gen_random_uuid(),
  case_id text unique not null,
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text not null,
  age integer not null constraint case_submissions_age_valid check (age between 18 and 120),
  city text not null,
  country text not null,
  case_description text not null,
  loss_range text not null,
  status text not null default 'submitted',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.case_submissions
add column if not exists age integer;

create table if not exists public.case_proofs (
  id uuid primary key default gen_random_uuid(),
  case_submission_id uuid not null references public.case_submissions(id) on delete cascade,
  proof_notes text not null,
  files jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_case_submissions_case_id on public.case_submissions(case_id);
create index if not exists idx_case_submissions_email on public.case_submissions(email);
create index if not exists idx_case_proofs_submission on public.case_proofs(case_submission_id);

alter table public.case_submissions enable row level security;
alter table public.case_proofs enable row level security;

drop policy if exists "No direct access to case submissions" on public.case_submissions;
create policy "No direct access to case submissions"
on public.case_submissions
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists "No direct access to case proofs" on public.case_proofs;
create policy "No direct access to case proofs"
on public.case_proofs
for all
to anon, authenticated
using (false)
with check (false);
