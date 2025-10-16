begin;
-- Extend orders table to support soft-cancel with 5-minute grace period
create schema if not exists public;
-- 1) Drop old status check constraint (unknown name) and add new one including 'canceled'
do $$
declare cname text;
begin
select conname into cname
from pg_constraint
where conrelid = 'public.orders'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%status in%';
if cname is not null then execute format(
    'alter table public.orders drop constraint %I',
    cname
);
end if;
exception
when others then null;
end $$;
alter table public.orders
add constraint orders_status_allowed check (
        status in ('pending', 'shipping', 'completed', 'canceled')
    );
-- 2) Add cancel metadata columns (idempotent)
do $$ begin perform 1
from information_schema.columns
where table_schema = 'public'
    and table_name = 'orders'
    and column_name = 'previous_status';
if not found then
alter table public.orders
add column previous_status text;
end if;
end $$;
do $$ begin perform 1
from information_schema.columns
where table_schema = 'public'
    and table_name = 'orders'
    and column_name = 'canceled_at';
if not found then
alter table public.orders
add column canceled_at timestamptz;
end if;
end $$;
do $$ begin perform 1
from information_schema.columns
where table_schema = 'public'
    and table_name = 'orders'
    and column_name = 'cancel_expires_at';
if not found then
alter table public.orders
add column cancel_expires_at timestamptz;
end if;
end $$;
-- 3) RPCs
-- Request cancel (soft cancel) if order is pending; second press while canceled deletes immediately
create or replace function public.rpc_request_cancel_order(p_user_id text, p_order_id bigint) returns public.orders language plpgsql security definer
set search_path = public as $$
declare v public.orders;
begin -- If already canceled: delete immediately
delete from public.order_items
where order_id = p_order_id
    and exists (
        select 1
        from public.orders o
        where o.id = p_order_id
            and o.user_id = p_user_id
            and o.status = 'canceled'
    );
delete from public.orders
where id = p_order_id
    and user_id = p_user_id
    and status = 'canceled'
returning * into v;
if found then return v;
-- return deleted row snapshot (may be null fields); caller can refetch list
end if;
-- Only allow cancel when pending
update public.orders
set previous_status = status,
    status = 'canceled',
    canceled_at = now(),
    cancel_expires_at = now() + interval '5 minutes',
    updated_at = now()
where id = p_order_id
    and user_id = p_user_id
    and status = 'pending'
returning * into v;
if not found then raise exception 'Order cannot be canceled (not found or status not pending)';
end if;
return v;
end;
$$;
-- Undo cancel within grace window
create or replace function public.rpc_undo_cancel_order(p_user_id text, p_order_id bigint) returns public.orders language plpgsql security definer
set search_path = public as $$
declare v public.orders;
begin
update public.orders
set status = coalesce(previous_status, 'pending'),
    previous_status = null,
    canceled_at = null,
    cancel_expires_at = null,
    updated_at = now()
where id = p_order_id
    and user_id = p_user_id
    and status = 'canceled'
    and (
        cancel_expires_at is null
        or now() < cancel_expires_at
    )
returning * into v;
if not found then raise exception 'Cannot undo cancel (not canceled or expired)';
end if;
return v;
end;
$$;
-- Cleanup: delete orders that stayed canceled beyond grace period (optionally for a user)
create or replace function public.rpc_cleanup_expired_cancellations(p_user_id text default null) returns int language plpgsql security definer
set search_path = public as $$
declare deleted_count int;
begin -- delete items first (via cascade from orders if FK defined), but ensure cascade exists
if p_user_id is null then
delete from public.orders o
where o.status = 'canceled'
    and o.cancel_expires_at is not null
    and now() >= o.cancel_expires_at
returning 1 into deleted_count;
else
delete from public.orders o
where o.user_id = p_user_id
    and o.status = 'canceled'
    and o.cancel_expires_at is not null
    and now() >= o.cancel_expires_at
returning 1 into deleted_count;
end if;
return coalesce(deleted_count, 0);
end;
$$;
-- Grants
do $$ begin execute 'revoke all on function public.rpc_request_cancel_order(text, bigint) from public';
execute 'revoke all on function public.rpc_undo_cancel_order(text, bigint) from public';
execute 'revoke all on function public.rpc_cleanup_expired_cancellations(text) from public';
exception
when others then null;
end $$;
do $$ begin execute 'grant execute on function public.rpc_request_cancel_order(text, bigint) to anon';
execute 'grant execute on function public.rpc_undo_cancel_order(text, bigint) to anon';
execute 'grant execute on function public.rpc_cleanup_expired_cancellations(text) to anon';
exception
when others then null;
end $$;
commit;