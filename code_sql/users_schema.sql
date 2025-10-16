-- =====================================================================
-- Supabase SQL – Users table for Zalo Login (ID/Name/Avatar/Phone)
-- One-file setup: table + RLS + policies + triggers + RPC functions
-- Safe to run multiple times (idempotent best-effort)
-- =====================================================================
begin;
-- 0) Schema guard (use public)
create schema if not exists public;
-- 1) Core table
create table if not exists public.users (
    id text primary key,
    -- Zalo user ID (unique per user)
    name text,
    avatar text,
    phone text,
    last_login timestamptz,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);
comment on table public.users is 'Users mapped from Zalo (Mini App). Source of truth for profile data.';
comment on column public.users.id is 'Zalo User ID';
comment on column public.users.name is 'Display name (from Zalo or edited)';
comment on column public.users.avatar is 'Avatar URL from Zalo';
comment on column public.users.phone is 'Phone number (manual or decoded via server when eligible)';
comment on column public.users.last_login is 'Last login timestamp (from app)';
-- 1.1) updated_at trigger
create or replace function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now();
return new;
end;
$$;
drop trigger if exists trg_users_updated_at on public.users;
create trigger trg_users_updated_at before
update on public.users for each row execute procedure public.set_updated_at();
-- 2) RLS & direct access hardening
alter table public.users enable row level security;
-- Revoke direct table privileges from public/anon/authenticated (client roles)
do $$ begin execute 'revoke all on table public.users from public';
execute 'revoke all on table public.users from anon';
execute 'revoke all on table public.users from authenticated';
exception
when others then null;
-- ignore if roles don''t exist yet
end $$;
-- Optional: allow service_role full access (server-side/admin only)
do $$ begin execute 'grant select, insert, update, delete on table public.users to service_role';
exception
when others then null;
end $$;
-- Deny-all policies to ensure no direct table access from client
drop policy if exists "users_deny_all_select" on public.users;
drop policy if exists "users_deny_all_insert" on public.users;
drop policy if exists "users_deny_all_update" on public.users;
drop policy if exists "users_deny_all_delete" on public.users;
create policy "users_deny_all_select" on public.users for
select using (false);
create policy "users_deny_all_insert" on public.users for
insert with check (false);
create policy "users_deny_all_update" on public.users for
update using (false);
create policy "users_deny_all_delete" on public.users for delete using (false);
-- 3) RPC (security definer) – the only client entrypoints
-- Notes:
--  - SECURITY DEFINER lets function bypass RLS, but logic is parameter-bound
--  - SET search_path = public to avoid search_path hijacking
-- 3.1) Upsert user after Zalo login
create or replace function public.upsert_user_by_zalo(
        p_id text,
        p_name text default null,
        p_avatar text default null,
        p_phone text default null,
        p_last_login timestamptz default now()
    ) returns public.users language plpgsql security definer
set search_path = public as $$
declare v_user public.users;
begin if p_id is null
or length(p_id) = 0 then raise exception 'p_id (Zalo user id) is required';
end if;
insert into public.users (id, name, avatar, phone, last_login)
values (
        p_id,
        nullif(p_name, ''),
        nullif(p_avatar, ''),
        nullif(p_phone, ''),
        coalesce(p_last_login, now())
    ) on conflict (id) do
update
set name = coalesce(excluded.name, public.users.name),
    avatar = coalesce(excluded.avatar, public.users.avatar),
    phone = coalesce(excluded.phone, public.users.phone),
    last_login = excluded.last_login,
    updated_at = now()
returning * into v_user;
return v_user;
end;
$$;
comment on function public.upsert_user_by_zalo(text, text, text, text, timestamptz) is 'Insert/update user row by Zalo ID. Client-safe RPC.';
-- 3.2) Fetch user by Zalo ID
create or replace function public.get_user_by_zalo(p_id text) returns public.users language sql security definer
set search_path = public stable as $$
select *
from public.users
where id = p_id;
$$;
comment on function public.get_user_by_zalo(text) is 'Get single user by Zalo ID. Client-safe RPC.';
-- 3.3) Update profile (name/phone)
create or replace function public.update_user_profile(
        p_id text,
        p_name text default null,
        p_phone text default null
    ) returns public.users language plpgsql security definer
set search_path = public as $$
declare v_user public.users;
begin if p_id is null
or length(p_id) = 0 then raise exception 'p_id (Zalo user id) is required';
end if;
update public.users
set name = coalesce(nullif(p_name, ''), name),
    phone = coalesce(nullif(p_phone, ''), phone),
    updated_at = now()
where id = p_id
returning * into v_user;
return v_user;
end;
$$;
comment on function public.update_user_profile(text, text, text) is 'Update editable profile fields (name/phone) for a Zalo user ID. Client-safe RPC.';
-- 3.4) Restrict function execution to anon (client) – optional also authenticated
do $$ begin -- Revoke from PUBLIC just in case
execute 'revoke all on function public.upsert_user_by_zalo(text, text, text, text, timestamptz) from public';
execute 'revoke all on function public.get_user_by_zalo(text) from public';
execute 'revoke all on function public.update_user_profile(text, text, text) from public';
exception
when others then null;
end $$;
do $$ begin execute 'grant execute on function public.upsert_user_by_zalo(text, text, text, text, timestamptz) to anon';
execute 'grant execute on function public.get_user_by_zalo(text) to anon';
execute 'grant execute on function public.update_user_profile(text, text, text) to anon';
exception
when others then null;
end $$;
commit;
-- =====================================================================
-- How to use (client):
-- 1) upsert_user_by_zalo(p_id, p_name, p_avatar, p_phone, p_last_login)
-- 2) get_user_by_zalo(p_id)
-- 3) update_user_profile(p_id, p_name, p_phone)
-- All direct table access is blocked by RLS; only these RPCs are allowed.
-- =====================================================================