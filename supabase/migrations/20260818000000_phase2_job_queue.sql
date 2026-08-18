begin;

create table public.sites (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  domain text not null,
  site_token_hash text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sites_name_not_blank
    check (char_length(btrim(name)) between 1 and 200),
  constraint sites_domain_normalized
    check (
      char_length(domain) between 1 and 253
      and domain = lower(btrim(domain))
    ),
  constraint sites_domain_unique unique (domain),
  constraint sites_token_hash_format
    check (site_token_hash ~ '^[0-9a-f]{64}$'),
  constraint sites_token_hash_unique unique (site_token_hash),
  constraint sites_status_allowed
    check (status in ('active', 'disabled'))
);

create table public.runners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  token_hash text not null,
  status text not null default 'offline',
  last_seen_at timestamptz,
  current_job_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint runners_name_not_blank
    check (char_length(btrim(name)) between 1 and 200),
  constraint runners_name_unique unique (name),
  constraint runners_token_hash_format
    check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint runners_token_hash_unique unique (token_hash),
  constraint runners_status_allowed
    check (status in ('online', 'offline', 'disabled'))
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null,
  type text not null default 'generate_section',
  prompt text not null,
  context_json jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  result_shortcode text,
  error_message text,
  claimed_by_runner_id uuid,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  constraint jobs_site_fk
    foreign key (site_id) references public.sites (id) on delete restrict,
  constraint jobs_claimed_runner_fk
    foreign key (claimed_by_runner_id) references public.runners (id) on delete restrict,
  constraint jobs_type_allowed
    check (type in ('generate_section')),
  constraint jobs_prompt_not_blank
    check (char_length(btrim(prompt)) between 1 and 10000),
  constraint jobs_context_is_object
    check (jsonb_typeof(context_json) = 'object'),
  constraint jobs_status_allowed
    check (status in ('pending', 'processing', 'completed', 'failed')),
  constraint jobs_started_after_created
    check (started_at is null or started_at >= created_at),
  constraint jobs_completed_after_started
    check (
      completed_at is null
      or (started_at is not null and completed_at >= started_at)
    ),
  constraint jobs_state_shape
    check (
      (
        status = 'pending'
        and claimed_by_runner_id is null
        and started_at is null
        and completed_at is null
        and result_shortcode is null
        and error_message is null
      )
      or
      (
        status = 'processing'
        and claimed_by_runner_id is not null
        and started_at is not null
        and completed_at is null
        and result_shortcode is null
        and error_message is null
      )
      or
      (
        status = 'completed'
        and claimed_by_runner_id is not null
        and started_at is not null
        and completed_at is not null
        and result_shortcode is not null
        and char_length(btrim(result_shortcode)) > 0
        and error_message is null
      )
      or
      (
        status = 'failed'
        and claimed_by_runner_id is not null
        and started_at is not null
        and completed_at is not null
        and result_shortcode is null
        and error_message is not null
        and char_length(btrim(error_message)) between 1 and 4000
      )
    )
);

alter table public.runners
  add constraint runners_current_job_fk
  foreign key (current_job_id) references public.jobs (id) on delete set null;

create unique index runners_current_job_unique_idx
  on public.runners (current_job_id)
  where current_job_id is not null;

create unique index jobs_one_processing_per_runner_idx
  on public.jobs (claimed_by_runner_id)
  where status = 'processing';

create index jobs_pending_queue_idx
  on public.jobs (created_at, id)
  where status = 'pending';

create index jobs_status_created_idx
  on public.jobs (status, created_at desc);

create index jobs_site_created_idx
  on public.jobs (site_id, created_at desc);

create index jobs_runner_created_idx
  on public.jobs (claimed_by_runner_id, created_at desc)
  where claimed_by_runner_id is not null;

create index runners_last_seen_idx
  on public.runners (last_seen_at desc);

create function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

create function public.enforce_job_status_transition()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.status = 'pending' and new.status = 'processing' then
    return new;
  end if;

  if old.status = 'processing' and new.status in ('completed', 'failed') then
    return new;
  end if;

  raise exception 'Invalid job status transition from % to %', old.status, new.status
    using errcode = '23514';
end;
$$;

create trigger sites_set_updated_at
before update on public.sites
for each row execute function public.set_updated_at();

create trigger runners_set_updated_at
before update on public.runners
for each row execute function public.set_updated_at();

create trigger jobs_enforce_status_transition
before update of status on public.jobs
for each row
when (old.status is distinct from new.status)
execute function public.enforce_job_status_transition();

create function public.claim_next_job(p_runner_id uuid)
returns table (
  id uuid,
  type text,
  prompt text,
  context_json jsonb
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_current_job_id uuid;
  v_job public.jobs%rowtype;
begin
  select runner.current_job_id
    into v_current_job_id
  from public.runners as runner
  where runner.id = p_runner_id
    and runner.status = 'online'
    and runner.last_seen_at >= pg_catalog.now() - interval '30 seconds'
  for update;

  if not found then
    raise exception 'Runner is not available to claim jobs'
      using errcode = 'P0001';
  end if;

  if v_current_job_id is not null then
    raise exception 'Runner already has an active job'
      using errcode = 'P0001';
  end if;

  select job.*
    into v_job
  from public.jobs as job
  where job.status = 'pending'
  order by job.created_at asc, job.id asc
  limit 1
  for update skip locked;

  if not found then
    return;
  end if;

  update public.jobs as job
  set
    status = 'processing',
    claimed_by_runner_id = p_runner_id,
    started_at = pg_catalog.now()
  where job.id = v_job.id;

  update public.runners as runner
  set current_job_id = v_job.id
  where runner.id = p_runner_id;

  return query
  select v_job.id, v_job.type, v_job.prompt, v_job.context_json;
end;
$$;

create function public.complete_runner_job(
  p_runner_id uuid,
  p_job_id uuid,
  p_result_shortcode text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_current_job_id uuid;
  v_updated_job_id uuid;
begin
  if p_result_shortcode is null
    or char_length(btrim(p_result_shortcode)) = 0
    or char_length(p_result_shortcode) > 500000 then
    raise exception 'Result shortcode is invalid'
      using errcode = 'P0001';
  end if;

  select runner.current_job_id
    into v_current_job_id
  from public.runners as runner
  where runner.id = p_runner_id
    and runner.status = 'online'
  for update;

  if not found or v_current_job_id is distinct from p_job_id then
    raise exception 'Job is not assigned to this runner'
      using errcode = 'P0001';
  end if;

  update public.jobs as job
  set
    status = 'completed',
    result_shortcode = p_result_shortcode,
    error_message = null,
    completed_at = pg_catalog.now()
  where job.id = p_job_id
    and job.claimed_by_runner_id = p_runner_id
    and job.status = 'processing'
  returning job.id into v_updated_job_id;

  if not found then
    raise exception 'Job cannot be completed from its current state'
      using errcode = 'P0001';
  end if;

  update public.runners as runner
  set current_job_id = null
  where runner.id = p_runner_id
    and runner.current_job_id = p_job_id;

  return true;
end;
$$;

create function public.fail_runner_job(
  p_runner_id uuid,
  p_job_id uuid,
  p_error_message text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_current_job_id uuid;
  v_updated_job_id uuid;
begin
  if p_error_message is null
    or char_length(btrim(p_error_message)) = 0
    or char_length(p_error_message) > 4000 then
    raise exception 'Failure message is invalid'
      using errcode = 'P0001';
  end if;

  select runner.current_job_id
    into v_current_job_id
  from public.runners as runner
  where runner.id = p_runner_id
    and runner.status = 'online'
  for update;

  if not found or v_current_job_id is distinct from p_job_id then
    raise exception 'Job is not assigned to this runner'
      using errcode = 'P0001';
  end if;

  update public.jobs as job
  set
    status = 'failed',
    result_shortcode = null,
    error_message = p_error_message,
    completed_at = pg_catalog.now()
  where job.id = p_job_id
    and job.claimed_by_runner_id = p_runner_id
    and job.status = 'processing'
  returning job.id into v_updated_job_id;

  if not found then
    raise exception 'Job cannot be failed from its current state'
      using errcode = 'P0001';
  end if;

  update public.runners as runner
  set current_job_id = null
  where runner.id = p_runner_id
    and runner.current_job_id = p_job_id;

  return true;
end;
$$;

alter table public.sites enable row level security;
alter table public.runners enable row level security;
alter table public.jobs enable row level security;

revoke all privileges on table public.sites from public, anon, authenticated;
revoke all privileges on table public.runners from public, anon, authenticated;
revoke all privileges on table public.jobs from public, anon, authenticated;

grant select, insert, update, delete on table public.sites to service_role;
grant select, insert, update, delete on table public.runners to service_role;
grant select, insert, update, delete on table public.jobs to service_role;

revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.enforce_job_status_transition() from public, anon, authenticated;
revoke all on function public.claim_next_job(uuid) from public, anon, authenticated;
revoke all on function public.complete_runner_job(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.fail_runner_job(uuid, uuid, text) from public, anon, authenticated;

grant execute on function public.set_updated_at() to service_role;
grant execute on function public.enforce_job_status_transition() to service_role;
grant execute on function public.claim_next_job(uuid) to service_role;
grant execute on function public.complete_runner_job(uuid, uuid, text) to service_role;
grant execute on function public.fail_runner_job(uuid, uuid, text) to service_role;

comment on table public.sites is
  'WordPress sites known to NCloud. Raw site tokens are never stored.';
comment on table public.runners is
  'Authenticated local runners. Raw runner tokens are never stored.';
comment on table public.jobs is
  'Sequential section-generation jobs and their terminal results.';
comment on function public.claim_next_job(uuid) is
  'Atomically locks one runner and claims the oldest pending job with SKIP LOCKED.';
comment on function public.complete_runner_job(uuid, uuid, text) is
  'Atomically completes an owned processing job and clears the runner current job.';
comment on function public.fail_runner_job(uuid, uuid, text) is
  'Atomically fails an owned processing job and clears the runner current job.';

commit;
