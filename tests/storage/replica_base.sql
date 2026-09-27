-- Minimal Supabase-like replica for LOCAL storage policy tests only. Fake test ids; no real data.
-- Minimal Supabase replica: roles, auth.uid(), storage schema, production public tables + policies.
do $$ begin if not exists (select 1 from pg_roles where rolname=$q$anon$q$) then create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; end if; end $$;
create schema auth; create schema storage;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth, storage, public to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
create table storage.buckets(id text primary key, name text not null, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id),
  name text not null, owner_id text default (auth.uid())::text, metadata jsonb, created_at timestamptz default now(),
  unique(bucket_id, name));
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language plpgsql immutable as
$$ declare _parts text[]; begin select string_to_array(name, '/') into _parts; return _parts[1:array_length(_parts,1)-1]; end $$;
grant execute on function storage.foldername(text) to anon, authenticated;
grant all on storage.objects to anon, authenticated; grant select on storage.buckets to anon, authenticated;

create table public.stables(id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create unique index stables_one_per_owner on public.stables(owner_id);
create table public.horses(stable_id uuid not null references public.stables(id) on delete cascade, id text not null,
  data jsonb not null default '{}', updated_at timestamptz not null default now(), deleted_at timestamptz, primary key(stable_id, id));
alter table public.stables enable row level security; alter table public.horses enable row level security;
create policy "Users can view their own stables" on public.stables for select using ((select auth.uid()) = owner_id);
create policy "Users can create their own stables" on public.stables for insert with check ((select auth.uid()) = owner_id);
create policy "Users can update their own stables" on public.stables for update using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "Users can view horses in their own stables" on public.horses for select using (exists (select 1 from public.stables s where s.id = horses.stable_id and s.owner_id = (select auth.uid())));
create policy "Users can create horses in their own stables" on public.horses for insert with check (exists (select 1 from public.stables s where s.id = horses.stable_id and s.owner_id = (select auth.uid())));
create policy "Users can update horses in their own stables" on public.horses for update using (exists (select 1 from public.stables s where s.id = horses.stable_id and s.owner_id = (select auth.uid()))) with check (exists (select 1 from public.stables s where s.id = horses.stable_id and s.owner_id = (select auth.uid())));
grant select, insert, update on public.stables, public.horses to authenticated;
create or replace function public.enforce_horses_per_stable_limit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  horse_row_count bigint;
begin
  -- Serialize inserts for one stable so simultaneous requests cannot both
  -- pass the count check and exceed the limit.
  perform 1
  from public.stables
  where id = new.stable_id
  for update;

  -- Supabase upsert runs BEFORE INSERT triggers before resolving a conflict.
  -- Allow an existing (stable_id, id) row to continue to the update path even
  -- when the stable already contains exactly 2,000 rows.
  if exists (
    select 1
    from public.horses
    where stable_id = new.stable_id
      and id = new.id
  ) then
    return new;
  end if;

  select count(*)
  into horse_row_count
  from public.horses
  where stable_id = new.stable_id;

  if horse_row_count >= 2000 then
    raise exception using
      errcode = 'P0001',
      message = 'A stable can contain at most 2,000 horse rows.',
      hint = 'Remove a horse row before adding another.';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_horses_per_stable_limit() from public;
revoke all on function public.enforce_horses_per_stable_limit() from anon;
revoke all on function public.enforce_horses_per_stable_limit() from authenticated;

create trigger enforce_horses_per_stable_limit
before insert on public.horses
for each row
execute function public.enforce_horses_per_stable_limit();
insert into auth.users values ('aaaaaaaa-0000-0000-0000-000000000001'),('bbbbbbbb-0000-0000-0000-000000000002');
insert into public.stables(id, owner_id, name) values ('aaaaaaaa-1111-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','A'),
  ('bbbbbbbb-1111-0000-0000-000000000002','bbbbbbbb-0000-0000-0000-000000000002','B');
insert into public.horses(stable_id, id) values ('aaaaaaaa-1111-0000-0000-000000000001','h_alive'),
  ('bbbbbbbb-1111-0000-0000-000000000002','h_bonly');
insert into public.horses(stable_id, id, deleted_at) values ('aaaaaaaa-1111-0000-0000-000000000001','h_gone', now());
