begin;

-- NCloud administrator accounts.
--
-- One account is enough for V1, but the shape supports more later. Only a
-- password hash is stored: the plaintext password never reaches this table, is
-- never logged, and is never returned by any API.
--
-- Additive only. No existing table, column, constraint, function, trigger, or
-- row is altered.

set local lock_timeout = '5s';

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  -- Stored already normalized to lower case, so a lookup is an exact match and
  -- two accounts cannot differ only by capitalisation.
  username text not null,
  -- A versioned scrypt hash. Never a plaintext or unsalted digest.
  password_hash text not null,
  -- A newly bootstrapped account must set a real password before it can use
  -- the application, so the temporary password is never a lasting credential.
  must_change_password boolean not null default true,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_login_at timestamptz,
  constraint admin_users_username_normalized
    check (
      username = lower(btrim(username))
      and char_length(username) between 3 and 100
    ),
  constraint admin_users_username_unique unique (username),
  constraint admin_users_password_hash_format
    check (password_hash like 'scrypt$%'),
  constraint admin_users_status_allowed
    check (status in ('active', 'disabled'))
);

-- Reuse the existing helper rather than adding a second one.
do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_trigger
    where tgrelid = 'public.admin_users'::regclass
      and tgname = 'admin_users_set_updated_at'
  ) then
    create trigger admin_users_set_updated_at
    before update on public.admin_users
    for each row execute function public.set_updated_at();
  end if;
end
$$;

-- Same posture as every other application table: row level security on with no
-- policy, all privileges revoked from anon and authenticated, and access only
-- for service_role, which the Control App uses server-side. A browser must
-- never be able to read this table, and no policy exists that would let it.
alter table public.admin_users enable row level security;

revoke all privileges on table public.admin_users from public, anon, authenticated;

grant select, insert, update, delete on table public.admin_users to service_role;

comment on table public.admin_users is
  'NCloud administrator accounts. Stores a versioned scrypt password hash only; plaintext passwords are never stored, logged, or returned.';

commit;
