alter table public.case_submissions
add column if not exists age integer;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'case_submissions_age_valid'
      and conrelid = 'public.case_submissions'::regclass
  ) then
    alter table public.case_submissions
    add constraint case_submissions_age_valid check (age between 18 and 120) not valid;
  end if;
end $$;
