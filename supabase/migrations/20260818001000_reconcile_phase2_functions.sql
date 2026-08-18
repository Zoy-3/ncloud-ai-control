begin;

-- Keep reconciliation bounded. If another session is executing one of these
-- functions, fail and roll back instead of waiting indefinitely.
set local lock_timeout = '5s';

-- Named input parameters are intentional: PostgREST uses them to bind the
-- JSON object supplied to Supabase RPC calls. PostgreSQL identifies overloads
-- by input types, so these remain the exact public.claim_next_job(uuid),
-- public.complete_runner_job(uuid, uuid, text), and
-- public.fail_runner_job(uuid, uuid, text) callable signatures.

create or replace function public.claim_next_job(p_runner_id uuid)
returns table (
  id uuid,
  type text,
  prompt text,
  context_json jsonb
)
language plpgsql
volatile
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

create or replace function public.complete_runner_job(
  p_runner_id uuid,
  p_job_id uuid,
  p_result_shortcode text
)
returns boolean
language plpgsql
volatile
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

create or replace function public.fail_runner_job(
  p_runner_id uuid,
  p_job_id uuid,
  p_error_message text
)
returns boolean
language plpgsql
volatile
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

-- PostgreSQL grants EXECUTE to PUBLIC for newly created functions by default.
-- Reassert the intended least-privilege RPC boundary in the same transaction.
revoke all on function public.claim_next_job(uuid)
  from public, anon, authenticated;
revoke all on function public.complete_runner_job(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.fail_runner_job(uuid, uuid, text)
  from public, anon, authenticated;

grant execute on function public.claim_next_job(uuid)
  to service_role;
grant execute on function public.complete_runner_job(uuid, uuid, text)
  to service_role;
grant execute on function public.fail_runner_job(uuid, uuid, text)
  to service_role;

comment on function public.claim_next_job(uuid) is
  'Atomically locks one runner and claims the oldest pending job with SKIP LOCKED.';
comment on function public.complete_runner_job(uuid, uuid, text) is
  'Atomically completes an owned processing job and clears the runner current job.';
comment on function public.fail_runner_job(uuid, uuid, text) is
  'Atomically fails an owned processing job and clears the runner current job.';

commit;
