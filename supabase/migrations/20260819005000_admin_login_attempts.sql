begin;

-- Shared login throttling for the administrator sign-in.
--
-- Vercel functions are per-instance and short-lived, so an in-memory counter
-- would reset constantly and give a false guarantee. The counter therefore
-- lives in Postgres, where every instance sees the same state, and is updated
-- through a function so a burst of concurrent attempts cannot race.
--
-- Only a salted hash of the identity is stored. No password, no raw address,
-- no Authorization header, and no username in the clear ever reaches this
-- table.
--
-- Additive only. No existing table, column, constraint, function, trigger, or
-- row is altered.

set local lock_timeout = '5s';

create table if not exists public.admin_login_attempts (
  -- One row per identity, overwritten in place, so the table is bounded by the
  -- number of distinct identities rather than by the number of attempts.
  identity_hash text primary key,
  failure_count integer not null default 0,
  window_started_at timestamptz not null default now(),
  blocked_until timestamptz,
  updated_at timestamptz not null default now(),
  constraint admin_login_attempts_identity_format
    check (identity_hash ~ '^[0-9a-f]{64}$'),
  constraint admin_login_attempts_count_sane
    check (failure_count between 0 and 1000000)
);

-- Supports the opportunistic cleanup below.
create index if not exists admin_login_attempts_updated_idx
  on public.admin_login_attempts (updated_at);

/**
 * Records one failed attempt and reports whether the identity is now blocked.
 *
 * The whole decision is a single statement, so concurrent attempts cannot read
 * a stale count and each other's increments are never lost. A window that has
 * already elapsed resets the count rather than accumulating forever.
 *
 * Returns the moment the block lifts, or null when the identity is not blocked.
 */
create or replace function public.record_admin_login_failure(
  p_identity_hash text,
  p_window_seconds integer,
  p_max_failures integer,
  p_block_seconds integer
)
returns timestamptz
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_blocked_until timestamptz;
begin
  -- Opportunistic retention: stale rows are removed while the table is already
  -- being written, so no scheduled job is required.
  delete from public.admin_login_attempts
  where updated_at < pg_catalog.now() - interval '24 hours';

  insert into public.admin_login_attempts as attempt (
    identity_hash,
    failure_count,
    window_started_at,
    blocked_until,
    updated_at
  )
  values (
    p_identity_hash,
    1,
    pg_catalog.now(),
    null,
    pg_catalog.now()
  )
  on conflict (identity_hash) do update
  set
    -- Start a fresh window when the previous one has elapsed.
    failure_count = case
      when attempt.window_started_at < pg_catalog.now() - make_interval(secs => p_window_seconds)
        then 1
      else attempt.failure_count + 1
    end,
    window_started_at = case
      when attempt.window_started_at < pg_catalog.now() - make_interval(secs => p_window_seconds)
        then pg_catalog.now()
      else attempt.window_started_at
    end,
    blocked_until = case
      when (
        case
          when attempt.window_started_at < pg_catalog.now() - make_interval(secs => p_window_seconds)
            then 1
          else attempt.failure_count + 1
        end
      ) >= p_max_failures
        then pg_catalog.now() + make_interval(secs => p_block_seconds)
      else attempt.blocked_until
    end,
    updated_at = pg_catalog.now()
  returning attempt.blocked_until into v_blocked_until;

  -- A first failure can only block when the threshold is one.
  if v_blocked_until is null and p_max_failures <= 1 then
    update public.admin_login_attempts
    set blocked_until = pg_catalog.now() + make_interval(secs => p_block_seconds)
    where identity_hash = p_identity_hash
    returning blocked_until into v_blocked_until;
  end if;

  if v_blocked_until is not null and v_blocked_until <= pg_catalog.now() then
    return null;
  end if;

  return v_blocked_until;
end;
$$;

/** Reports whether an identity is currently blocked, without recording anything. */
create or replace function public.admin_login_blocked_until(p_identity_hash text)
returns timestamptz
language sql
stable
security invoker
set search_path = ''
as $$
  select attempt.blocked_until
  from public.admin_login_attempts as attempt
  where attempt.identity_hash = p_identity_hash
    and attempt.blocked_until is not null
    and attempt.blocked_until > pg_catalog.now();
$$;

/** Clears the failure state for an identity after a successful sign-in. */
create or replace function public.clear_admin_login_failures(p_identity_hash text)
returns void
language sql
volatile
security invoker
set search_path = ''
as $$
  delete from public.admin_login_attempts
  where identity_hash = p_identity_hash;
$$;

alter table public.admin_login_attempts enable row level security;

revoke all privileges on table public.admin_login_attempts from public, anon, authenticated;

grant select, insert, update, delete on table public.admin_login_attempts to service_role;

revoke all on function public.record_admin_login_failure(text, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.admin_login_blocked_until(text) from public, anon, authenticated;
revoke all on function public.clear_admin_login_failures(text) from public, anon, authenticated;

grant execute on function public.record_admin_login_failure(text, integer, integer, integer) to service_role;
grant execute on function public.admin_login_blocked_until(text) to service_role;
grant execute on function public.clear_admin_login_failures(text) to service_role;

comment on table public.admin_login_attempts is
  'Shared administrator login throttling. One row per salted identity hash, overwritten in place. Stores no password, address, or plaintext username.';

commit;
